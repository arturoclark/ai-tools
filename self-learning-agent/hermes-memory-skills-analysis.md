# Hermes Agent Memory and Skills Analysis

This document summarizes how Hermes Agent handles:

- persistent memory
- skill creation and management
- skill discovery and invocation
- storage formats and query paths

It is grounded in the current codebase. Where I quote code, the goal is to show the exact mechanism Hermes uses rather than paraphrase vaguely.

## Executive Summary

Hermes treats **memory** and **skills** as two different long-term knowledge systems:

- **Memory** is small, durable, declarative fact storage.
  - Built-in memory is file-backed and stored under `~/.hermes/memories/`.
  - External memory providers are plugin-backed and selected via `memory.provider`.
- **Skills** are procedural knowledge bundles.
  - Skill content lives under `~/.hermes/skills/` as `SKILL.md` directories.
  - Skills are usually indexed lightly, then loaded on demand.

The most important design split is:

- **memory stores facts**
- **skills store procedures**

Hermes reinforces that distinction in both prompt guidance and tool behavior.

## 1. Built-in Memory

### Where it is stored

The built-in memory store is profile-scoped and file-backed:

```python
def get_memory_dir() -> Path:
    """Return the profile-scoped memories directory."""
    return get_hermes_home() / "memories"
```

From [tools/memory_tool.py](/Users/arturoclark/development/hermes-agent/tools/memory_tool.py:55).

Hermes stores two files:

- `~/.hermes/memories/MEMORY.md`
- `~/.hermes/memories/USER.md`

The module describes them like this:

```python
Provides bounded, file-backed memory that persists across sessions. Two stores:
  - MEMORY.md: agent's personal notes and observations
  - USER.md: what the agent knows about the user
```

From [tools/memory_tool.py](/Users/arturoclark/development/hermes-agent/tools/memory_tool.py:5).

### How entries are represented

Entries are stored as a delimited flat list, not structured JSON:

```python
ENTRY_DELIMITER = "\n§\n"
```

From [tools/memory_tool.py](/Users/arturoclark/development/hermes-agent/tools/memory_tool.py:59).

On read:

```python
entries = [e.strip() for e in raw.split(ENTRY_DELIMITER)]
return [e for e in entries if e]
```

From [tools/memory_tool.py](/Users/arturoclark/development/hermes-agent/tools/memory_tool.py:512).

So Hermes uses:

- one file per memory target
- one entry list per file
- a custom section delimiter instead of IDs or row objects

### When it loads memory

The agent initializes built-in memory during agent setup:

```python
if agent._memory_enabled or agent._user_profile_enabled:
    from tools.memory_tool import MemoryStore
    agent._memory_store = MemoryStore(
        memory_char_limit=mem_config.get("memory_char_limit", 2200),
        user_char_limit=mem_config.get("user_char_limit", 1375),
    )
    agent._memory_store.load_from_disk()
```

From [agent/agent_init.py](/Users/arturoclark/development/hermes-agent/agent/agent_init.py:1076).

This means built-in memory is:

- opt-in/config-gated
- loaded once at agent startup
- kept in memory during the session

### How it is injected into the prompt

Hermes uses a **frozen snapshot** model.

The design is explicitly documented:

```python
Both are injected into the system prompt as a frozen snapshot at session start.
Mid-session writes update files on disk immediately (durable) but do NOT change
the system prompt -- this preserves the prefix cache for the entire session.
The snapshot refreshes on the next session start.
```

From [tools/memory_tool.py](/Users/arturoclark/development/hermes-agent/tools/memory_tool.py:11).

The snapshot is built in `load_from_disk()`:

```python
self._system_prompt_snapshot = {
    "memory": self._render_block("memory", sanitized_memory),
    "user": self._render_block("user", sanitized_user),
}
```

From [tools/memory_tool.py](/Users/arturoclark/development/hermes-agent/tools/memory_tool.py:167).

The system prompt assembly uses that frozen snapshot:

```python
if agent._memory_enabled:
    mem_block = agent._memory_store.format_for_system_prompt("memory")
if agent._user_profile_enabled:
    user_block = agent._memory_store.format_for_system_prompt("user")
```

From [agent/system_prompt.py](/Users/arturoclark/development/hermes-agent/agent/system_prompt.py:303).

This is a strong design choice worth copying. It gives Hermes:

- durable writes
- stable prompt caching
- no prompt churn after every memory write

### How writes work

The built-in memory tool exposes mutations through a single tool:

```python
"enum": ["add", "replace", "remove"]
```

From [tools/memory_tool.py](/Users/arturoclark/development/hermes-agent/tools/memory_tool.py:681).

Dispatch:

```python
if action == "add":
    result = store.add(target, content)
elif action == "replace":
    result = store.replace(target, old_text, content)
elif action == "remove":
    result = store.remove(target, old_text)
```

From [tools/memory_tool.py](/Users/arturoclark/development/hermes-agent/tools/memory_tool.py:620).

Important implementation details:

- writes are locked with a separate `.lock` file
- disk is reloaded under lock before mutation
- writes are atomic via temp file + rename
- exact duplicate adds are rejected
- capacity is bounded by character budgets
- content is threat-scanned before acceptance

Example:

```python
with self._file_lock(self._path_for(target)):
    bak = self._reload_target(target)
    if bak:
        return _drift_error(self._path_for(target), bak)
```

From [tools/memory_tool.py](/Users/arturoclark/development/hermes-agent/tools/memory_tool.py:308).

And atomic write:

```python
fd, tmp_path = tempfile.mkstemp(
    dir=str(path.parent), suffix=".tmp", prefix=".mem_"
)
...
atomic_replace(tmp_path, path)
```

From [tools/memory_tool.py](/Users/arturoclark/development/hermes-agent/tools/memory_tool.py:582).

### How it queries memory

Built-in memory does **not** do semantic retrieval. It simply injects the stored snapshot into the system prompt.

There is no search layer for `MEMORY.md` / `USER.md`. Querying is effectively:

- load the whole bounded store
- render it into the prompt
- let the model read it directly

That makes built-in memory simple and predictable, but not scalable.

### Safety and drift handling

Hermes is careful about the memory files being modified outside the tool. It explicitly detects “external drift”:

```python
drift_detected = (raw.strip() != roundtrip) or (max_entry_len > char_limit)
```

From [tools/memory_tool.py](/Users/arturoclark/development/hermes-agent/tools/memory_tool.py:555).

If drift is detected, Hermes refuses to write and creates a backup instead of risking silent data loss.

This is one of the strongest parts of the implementation.

## 2. External Memory Providers

### The abstraction

External memory is standardized behind `MemoryProvider`:

```python
class MemoryProvider(ABC):
    @abstractmethod
    def initialize(self, session_id: str, **kwargs) -> None:
    def system_prompt_block(self) -> str:
    def prefetch(self, query: str, *, session_id: str = "") -> str:
    def queue_prefetch(self, query: str, *, session_id: str = "") -> None:
    def sync_turn(self, user_content: str, assistant_content: str, *, session_id: str = "", messages=None) -> None:
    @abstractmethod
    def get_tool_schemas(self) -> List[Dict[str, Any]]:
```

From [agent/memory_provider.py](/Users/arturoclark/development/hermes-agent/agent/memory_provider.py:42).

Hermes expects providers to cover four concerns:

- initialization
- system-prompt guidance
- recall/prefetch
- post-turn persistence

### How providers are selected

Only one external provider can be active at once:

```python
Only ONE external plugin provider is allowed at a time
```

From [agent/memory_manager.py](/Users/arturoclark/development/hermes-agent/agent/memory_manager.py:6).

Enforced here:

```python
if self._has_external:
    logger.warning(
        "Rejected memory provider '%s' ... Only one external memory provider is allowed at a time."
    )
    return
```

From [agent/memory_manager.py](/Users/arturoclark/development/hermes-agent/agent/memory_manager.py:267).

Activation happens during agent init:

```python
_mem_provider_name = mem_config.get("provider", "")
...
_mp = _load_mem(_mem_provider_name)
if _mp and _mp.is_available():
    agent._memory_manager.add_provider(_mp)
...
agent._memory_manager.initialize_all(**_init_kwargs)
```

From [agent/agent_init.py](/Users/arturoclark/development/hermes-agent/agent/agent_init.py:1093).

### Provider discovery

Providers are discovered from:

- bundled `plugins/memory/<name>/`
- user-installed `$HERMES_HOME/plugins/<name>/`

The discovery module says:

```python
1. Bundled providers: ``plugins/memory/<name>/``
2. User-installed providers: ``$HERMES_HOME/plugins/<name>/``
```

From [plugins/memory/__init__.py](/Users/arturoclark/development/hermes-agent/plugins/memory/__init__.py:3).

### When recall happens

Per turn, Hermes does two provider-related actions:

1. `on_turn_start(...)`
2. `prefetch_all(original_user_message)`

```python
agent._memory_manager.on_turn_start(agent._user_turn_count, _turn_msg)
...
_ext_prefetch_cache = agent._memory_manager.prefetch_all(_query) or ""
```

From [agent/conversation_loop.py](/Users/arturoclark/development/hermes-agent/agent/conversation_loop.py:767).

That prefetched context is not persisted into conversation history. It is injected only into the outgoing API payload:

```python
if _ext_prefetch_cache:
    _fenced = build_memory_context_block(_ext_prefetch_cache)
    if _fenced:
        _injections.append(_fenced)
```

From [agent/conversation_loop.py](/Users/arturoclark/development/hermes-agent/agent/conversation_loop.py:956).

The fence wrapper is:

```python
return (
    "<memory-context>\n"
    "[System note: The following is recalled memory context, "
    "NOT new user input. Treat as authoritative reference data ...]\n\n"
    f"{clean}\n"
    "</memory-context>"
)
```

From [agent/memory_manager.py](/Users/arturoclark/development/hermes-agent/agent/memory_manager.py:234).

This is a good pattern:

- provider recall is ephemeral
- the original transcript stays clean
- later persistence is not polluted by injected recall text

### When persistence happens

At end of a completed turn:

```python
self._memory_manager.sync_all(
    original_user_message,
    final_response,
    **sync_kwargs,
)
self._memory_manager.queue_prefetch_all(
    original_user_message,
    session_id=self.session_id or "",
)
```

From [run_agent.py](/Users/arturoclark/development/hermes-agent/run_agent.py:2830).

Hermes intentionally uses `original_user_message`, not the mutated user message with injected skill content or memory blocks.

### How provider tools are exposed

Providers can add their own tools, and Hermes routes them through `MemoryManager`:

```python
elif agent._memory_manager and agent._memory_manager.has_tool(function_name):
    function_result = agent._memory_manager.handle_tool_call(function_name, function_args)
```

From [agent/tool_executor.py](/Users/arturoclark/development/hermes-agent/agent/tool_executor.py:993).

### Example: Mem0

Mem0 shows the intended “semantic memory backend” pattern.

Config:

```python
config = {
    "api_key": os.environ.get("MEM0_API_KEY", ""),
    "user_id": os.environ.get("MEM0_USER_ID", "hermes-user"),
    "agent_id": os.environ.get("MEM0_AGENT_ID", "hermes"),
}
```

From [plugins/memory/mem0/__init__.py](/Users/arturoclark/development/hermes-agent/plugins/memory/mem0/__init__.py:49).

Prefetch:

```python
results = self._unwrap_results(client.search(
    query=query,
    filters=self._read_filters(),
    rerank=self._rerank,
    top_k=5,
))
```

From [plugins/memory/mem0/__init__.py](/Users/arturoclark/development/hermes-agent/plugins/memory/mem0/__init__.py:255).

Turn sync:

```python
messages = [
    {"role": "user", "content": user_content},
    {"role": "assistant", "content": assistant_content},
]
client.add(messages, **self._write_filters())
```

From [plugins/memory/mem0/__init__.py](/Users/arturoclark/development/hermes-agent/plugins/memory/mem0/__init__.py:281).

So Mem0 is:

- server-side extraction
- semantic search retrieval
- async/background sync and prefetch

### Example: Honcho

Honcho shows a richer plugin with:

- its own tool surface
- configurable recall modes
- session scoping
- async prewarming

Its provider advertises:

```python
ALL_TOOL_SCHEMAS = [PROFILE_SCHEMA, SEARCH_SCHEMA, REASONING_SCHEMA, CONTEXT_SCHEMA, CONCLUDE_SCHEMA]
```

From [plugins/memory/honcho/__init__.py](/Users/arturoclark/development/hermes-agent/plugins/memory/honcho/__init__.py:184).

And initializes with session- and user-scoped context:

```python
self._session_key = self._resolve_session_key(cfg, session_id, **kwargs)
```

From [plugins/memory/honcho/__init__.py](/Users/arturoclark/development/hermes-agent/plugins/memory/honcho/__init__.py:334).

## 3. Skills: Storage Model

### Where skills live

Hermes is explicit that the user skill tree is the source of truth:

```python
# All skills live in ~/.hermes/skills/ (single source of truth)
SKILLS_DIR = HERMES_HOME / "skills"
```

From [tools/skill_manager_tool.py](/Users/arturoclark/development/hermes-agent/tools/skill_manager_tool.py:107).

`tools/skills_tool.py` says the same:

```python
# All skills live in ~/.hermes/skills/ (seeded from bundled skills/ on install).
# This is the single source of truth
```

From [tools/skills_tool.py](/Users/arturoclark/development/hermes-agent/tools/skills_tool.py:87).

Directory structure:

```text
~/.hermes/skills/
  my-skill/
    SKILL.md
    references/
    templates/
    scripts/
    assets/
```

### What a skill is

Hermes expects a `SKILL.md` with YAML frontmatter and markdown body. Validation requires:

```python
if "name" not in parsed:
    return "Frontmatter must include 'name' field."
if "description" not in parsed:
    return "Frontmatter must include 'description' field."
```

From [tools/skill_manager_tool.py](/Users/arturoclark/development/hermes-agent/tools/skill_manager_tool.py:242).

So a skill is:

- a directory
- a required `SKILL.md`
- optional support files
- frontmatter-driven metadata

## 4. How Hermes Finds and Queries Skills

### Listing skill metadata

Hermes uses progressive disclosure. `skills_list()` returns only compact metadata:

```python
Returns only name + description to minimize token usage. Use skill_view() to
load full content
```

From [tools/skills_tool.py](/Users/arturoclark/development/hermes-agent/tools/skills_tool.py:655).

The scan path:

```python
all_skills = _find_all_skills()
```

From [tools/skills_tool.py](/Users/arturoclark/development/hermes-agent/tools/skills_tool.py:681).

And `_find_all_skills()`:

- scans `SKILLS_DIR`
- scans `skills.external_dirs`
- skips excluded dirs like `.git`, `.hub`, `.archive`, `node_modules`
- filters by platform and environment
- filters disabled skills from config

### Loading full skill content

`skill_view()` is the main query mechanism.

It resolves:

- local skills
- categorized local skills
- skills from `skills.external_dirs`
- plugin skills in `plugin:skill` form

It refuses ambiguous matches:

```python
"Refusing to guess — load one explicitly by its categorized path."
```

From [tools/skills_tool.py](/Users/arturoclark/development/hermes-agent/tools/skills_tool.py:999).

That is a useful design choice for your tool too: name collisions should fail loudly instead of shadowing.

### Loading support files

`skill_view(name, file_path=...)` supports secondary assets safely. It validates that the requested file stays inside the skill directory and blocks traversal.

### Skill preprocessing

Before returning main skill content, Hermes can preprocess:

- `${HERMES_SKILL_DIR}`
- `${HERMES_SESSION_ID}`
- inline shell snippets like ``!`date` ``

Implementation:

```python
if cfg.get("template_vars", True):
    content = substitute_template_vars(content, skill_dir, session_id)
if cfg.get("inline_shell", False):
    content = expand_inline_shell(content, skill_dir, timeout)
```

From [agent/skill_preprocessing.py](/Users/arturoclark/development/hermes-agent/agent/skill_preprocessing.py:133).

This makes skills more dynamic, but it also increases the attack surface. Hermes partly mitigates that with scanning and path checks.

## 5. How Skills Reach the Model

### Compact index in the system prompt

Hermes does **not** inject every skill body into the system prompt. It builds a compact index instead:

```python
"## Skills (mandatory)\n"
"Before replying, scan the skills below. If a skill matches or is even partially relevant "
"to your task, you MUST load it with skill_view(name) and follow its instructions.
```

From [agent/prompt_builder.py](/Users/arturoclark/development/hermes-agent/agent/prompt_builder.py:1248).

This index is built by `build_skills_system_prompt(...)`, with:

- in-process cache
- disk snapshot cache
- local/external dir merge
- tool/toolset-aware visibility filtering

Snapshot cache note:

```python
2. Disk snapshot (``.skills_prompt_snapshot.json``) validated by
mtime/size manifest — survives process restarts
```

From [agent/prompt_builder.py](/Users/arturoclark/development/hermes-agent/agent/prompt_builder.py:1061).

### On-demand skill loading

When a skill is explicitly invoked via slash command, Hermes builds a message containing:

- activation note
- full skill content
- absolute skill directory
- support file hints
- resolved config values

Example:

```python
activation_note = (
    f'[IMPORTANT: The user has invoked the "{skill_name}" skill, indicating they want '
    "you to follow its instructions. The full skill content is loaded below.]"
)
```

From [agent/skill_commands.py](/Users/arturoclark/development/hermes-agent/agent/skill_commands.py:465).

And:

```python
parts.append(f"[Skill directory: {skill_dir}]")
parts.append(
    "Resolve any relative paths in this skill ... against that directory"
)
```

From [agent/skill_commands.py](/Users/arturoclark/development/hermes-agent/agent/skill_commands.py:187).

This is one of Hermes’ better patterns for procedural knowledge delivery: the index stays cheap, but invocation gives the model enough operational context to use the skill immediately.

## 6. Skill Creation and Editing

### The core management tool

Hermes gives the agent one tool for skill lifecycle actions:

```python
"enum": ["create", "patch", "edit", "delete", "write_file", "remove_file"]
```

From [tools/skill_manager_tool.py](/Users/arturoclark/development/hermes-agent/tools/skill_manager_tool.py:937).

Dispatch:

```python
if action == "create":
    result = _create_skill(name, content, category)
elif action == "edit":
    result = _edit_skill(name, content)
elif action == "patch":
    result = _patch_skill(name, old_string, new_string, file_path, replace_all)
...
```

From [tools/skill_manager_tool.py](/Users/arturoclark/development/hermes-agent/tools/skill_manager_tool.py:833).

### Create path

Creation always targets the local skills tree:

```python
skill_dir = _resolve_skill_dir(name, category)
skill_dir.mkdir(parents=True, exist_ok=True)
skill_md = skill_dir / "SKILL.md"
_atomic_write_text(skill_md, content)
```

From [tools/skill_manager_tool.py](/Users/arturoclark/development/hermes-agent/tools/skill_manager_tool.py:505).

This is an important behavior difference:

- **new** skills are local-only
- **existing** skills may be found in local or external skill dirs for edit/patch/delete

### Patch path

Hermes prefers patching over full rewrites:

```python
"patch (old_string/new_string — preferred for fixes)"
```

From [tools/skill_manager_tool.py](/Users/arturoclark/development/hermes-agent/tools/skill_manager_tool.py:906).

The patch implementation uses a fuzzy matcher:

```python
from tools.fuzzy_match import fuzzy_find_and_replace
new_content, match_count, _strategy, match_error = fuzzy_find_and_replace(
    content, old_string, new_string, replace_all
)
```

From [tools/skill_manager_tool.py](/Users/arturoclark/development/hermes-agent/tools/skill_manager_tool.py:610).

That makes the patch tool more robust than exact substring replacement.

### Supporting files

Hermes lets skills grow beyond `SKILL.md` through:

- `references/`
- `templates/`
- `scripts/`
- `assets/`

But only those subdirs are writable through `skill_manage`:

```python
ALLOWED_SUBDIRS = {"references", "templates", "scripts", "assets"}
```

From [tools/skill_manager_tool.py](/Users/arturoclark/development/hermes-agent/tools/skill_manager_tool.py:171).

### Validation and safety

Skill writes are guarded by:

- frontmatter validation
- content size caps
- file size caps
- path traversal checks
- optional security scanning
- atomic writes

Example:

```python
if not content.startswith("---"):
    return "SKILL.md must start with YAML frontmatter (---)."
```

From [tools/skill_manager_tool.py](/Users/arturoclark/development/hermes-agent/tools/skill_manager_tool.py:225).

And:

```python
if has_traversal_component(file_path):
    return "Path traversal ('..') is not allowed."
```

From [tools/skill_manager_tool.py](/Users/arturoclark/development/hermes-agent/tools/skill_manager_tool.py:413).

## 7. Skills Hub: Installed Skill Management

Hermes has a separate “hub” management surface for third-party or optional skills.

Hub state is stored under:

```python
SKILLS_DIR = HERMES_HOME / "skills"
HUB_DIR = SKILLS_DIR / ".hub"
LOCK_FILE = HUB_DIR / "lock.json"
QUARANTINE_DIR = HUB_DIR / "quarantine"
AUDIT_LOG = HUB_DIR / "audit.log"
TAPS_FILE = HUB_DIR / "taps.json"
INDEX_CACHE_DIR = HUB_DIR / "index-cache"
```

From [tools/skills_hub.py](/Users/arturoclark/development/hermes-agent/tools/skills_hub.py:49).

### Install flow

Hermes’ install pipeline is:

1. fetch bundle
2. write to quarantine
3. scan
4. move into `~/.hermes/skills/...`
5. record provenance in lock file
6. append audit log

Quarantine:

```python
def quarantine_bundle(bundle: SkillBundle) -> Path:
```

From [tools/skills_hub.py](/Users/arturoclark/development/hermes-agent/tools/skills_hub.py:3171).

Install:

```python
install_dir = _resolve_lock_install_path(install_rel_path, safe_skill_name)
...
shutil.move(str(quarantine_path), str(install_dir))
...
lock.record_install(...)
```

From [tools/skills_hub.py](/Users/arturoclark/development/hermes-agent/tools/skills_hub.py:3219).

### Provenance lock file

`skills/.hub/lock.json` tracks installed hub skills:

```python
data["installed"][safe_name] = {
    "source": source,
    "identifier": identifier,
    "trust_level": trust_level,
    "scan_verdict": scan_verdict,
    "content_hash": skill_hash,
    "install_path": safe_install_path,
    "files": files,
    "metadata": metadata or {},
    "installed_at": datetime.now(timezone.utc).isoformat(),
    "updated_at": datetime.now(timezone.utc).isoformat(),
}
```

From [tools/skills_hub.py](/Users/arturoclark/development/hermes-agent/tools/skills_hub.py:3058).

This is separate from skill content itself and is only for operational management.

## 8. Skill Usage Tracking

Hermes also stores usage telemetry in a sidecar:

```python
Tracks per-skill usage metadata in a sidecar JSON file (~/.hermes/skills/.usage.json)
```

From [tools/skill_usage.py](/Users/arturoclark/development/hermes-agent/tools/skill_usage.py:3).

That file tracks:

- view counts
- use counts
- patch counts
- timestamps
- curator lifecycle state
- agent-created provenance

Example bumps:

```python
def bump_view(skill_name: str) -> None:
def bump_use(skill_name: str) -> None:
def bump_patch(skill_name: str) -> None:
```

From [tools/skill_usage.py](/Users/arturoclark/development/hermes-agent/tools/skill_usage.py:557).

This is an important design distinction:

- `SKILL.md` holds the procedure
- `.usage.json` holds operational telemetry
- `.hub/lock.json` holds install provenance
- `.bundled_manifest` holds bundled-seed provenance

## 9. CLI Surfaces

### `/skills` and `hermes skills`

Hermes routes both to the same shared implementation:

```python
Powers both:
  - `hermes skills <subcommand>`
  - `/skills <subcommand>`
```

From [hermes_cli/skills_hub.py](/Users/arturoclark/development/hermes-agent/hermes_cli/skills_hub.py:5).

### Dynamic slash commands for installed skills

Hermes builds slash commands by scanning installed skills:

```python
def scan_skill_commands() -> Dict[str, Dict[str, Any]]:
    """Scan ~/.hermes/skills/ and return a mapping of /command -> skill info.
```

From [agent/skill_commands.py](/Users/arturoclark/development/hermes-agent/agent/skill_commands.py:263).

The CLI dispatches to those generated commands here:

```python
elif base_cmd in skill_commands:
    msg = build_skill_invocation_message(...)
```

From [cli.py](/Users/arturoclark/development/hermes-agent/cli.py:9186).

### Preloaded session skills

Hermes can also preload specific skills when the CLI session starts:

```python
if parsed_skills:
    skills_prompt, loaded_skills, missing_skills = build_preloaded_skills_prompt(...)
```

From [cli.py](/Users/arturoclark/development/hermes-agent/cli.py:15720).

## 10. Design Patterns Worth Reusing

If you want to build your own CLI tool “following what Hermes does,” these are the strongest patterns to copy:

### 1. Separate facts from procedures

- Memory is short, declarative, bounded.
- Skills are rich, procedural, file-tree based.

### 2. Keep skill content and skill operations separate

Use:

- `SKILL.md` for actual guidance
- sidecars for telemetry/provenance

Hermes does this with:

- `~/.hermes/skills/.usage.json`
- `~/.hermes/skills/.hub/lock.json`
- `~/.hermes/skills/.bundled_manifest`

### 3. Use progressive disclosure for skills

Do not inject all skill content into the system prompt. Hermes instead:

- indexes metadata globally
- loads full content only on demand

### 4. Freeze built-in memory per session

Hermes’ frozen memory snapshot is a good compromise between:

- persistence
- prompt stability
- cache efficiency

### 5. Use ephemeral recall injection for semantic memory

External provider recall is:

- generated per turn
- fenced
- injected only into the outgoing request
- not persisted into the transcript

### 6. Make destructive file actions path-safe and atomic

Hermes consistently uses:

- relative-path validation
- traversal blocking
- symlink checks
- temp-file-plus-rename writes

## 11. Important Nuances and Mismatches

### Built-in memory is not really a `MemoryProvider`

Some comments in `agent/memory_manager.py` talk as if the builtin provider is part of the provider list. In practice, the codebase separates them:

- built-in memory = `MemoryStore`
- external memory = `MemoryManager` + `MemoryProvider` plugins

That separation is clearer in behavior than in some comments.

### `memory_tool.py` docstring mentions `read`, but the tool does not expose it

The top docstring says:

```python
- Single `memory` tool with action parameter: add, replace, remove, read
```

From [tools/memory_tool.py](/Users/arturoclark/development/hermes-agent/tools/memory_tool.py:20).

But the actual schema only allows:

- `add`
- `replace`
- `remove`

That is an implementation/documentation mismatch you should not copy blindly.

### New skills are always created locally

Even though Hermes can read/edit skills from external dirs, creation goes to local `~/.hermes/skills/`. That is a deliberate ownership model.

## 12. Detailed Technical Section

### Memory lifecycle

1. Agent init reads memory config in [agent/agent_init.py](/Users/arturoclark/development/hermes-agent/agent/agent_init.py:1070).
2. Built-in `MemoryStore` loads `MEMORY.md` and `USER.md`.
3. A frozen prompt snapshot is created.
4. Optional external memory provider is loaded from `memory.provider`.
5. On each turn:
   - `on_turn_start(...)`
   - `prefetch_all(...)`
   - prefetched context is wrapped in `<memory-context>`
   - injected into the current API request only
6. On built-in memory writes:
   - file lock
   - reload under lock
   - threat scan
   - atomic save
   - optional bridge notification to external provider via `on_memory_write(...)`
7. On successful completed turns:
   - external providers get `sync_all(...)`
   - external providers get `queue_prefetch_all(...)`
8. On session end or rotation:
   - `on_session_end(...)`
   - `shutdown_all()` or `on_session_switch(...)`

### Skill lifecycle

1. Skills live in `~/.hermes/skills/`.
2. Discovery scans local + external dirs.
3. The system prompt gets a compact skill index.
4. The full skill is loaded only with `skill_view(...)` or a slash command.
5. Slash invocation builds a user message containing the skill body and runtime hints.
6. `skill_manage(...)` handles create/edit/patch/delete/file updates.
7. Hub-installed skills go through quarantine, scan, install, and lock-file recording.
8. Usage telemetry is bumped on:
   - view
   - use
   - patch/edit/write

### Storage map

Built-in memory:

- `~/.hermes/memories/MEMORY.md`
- `~/.hermes/memories/USER.md`

Skill content:

- `~/.hermes/skills/<category?>/<skill>/SKILL.md`
- `references/`
- `templates/`
- `scripts/`
- `assets/`

Skill operational metadata:

- `~/.hermes/skills/.usage.json`
- `~/.hermes/skills/.hub/lock.json`
- `~/.hermes/skills/.hub/audit.log`
- `~/.hermes/skills/.hub/quarantine/`
- `~/.hermes/skills/.hub/index-cache/`
- `~/.hermes/skills/.bundled_manifest`
- skill prompt snapshot cache: `.skills_prompt_snapshot.json`

## 13. Bottom Line for Your CLI Tool

If you want to replicate Hermes’ approach cleanly, the architecture to copy is:

- **memory layer**
  - one simple built-in store for durable facts
  - optional pluggable semantic providers
  - built-in memory injected as a frozen per-session snapshot
  - external recall injected ephemerally per turn

- **skill layer**
  - filesystem-native `SKILL.md` directories
  - metadata-only indexing
  - full-content lazy loading
  - separate management tool for create/edit/patch/delete
  - separate sidecars for usage and provenance

That is the core Hermes pattern.
