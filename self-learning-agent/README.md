# self-learning-agent-cli

`self-learning-agent-cli` installs the `sla` CLI, a profile-scoped memory and skills manager for agents. It supports two storage modes:

- standard SLA mode under `~/.sla/`
- Hermes mode under `~/.hermes/`

It also exposes explicit JSON output for agent consumption and can install host-specific wrappers.

## Requirements

- Node.js `>=20`

## Install

```bash
npm install -g self-learning-agent-cli
```

Run `sla help` after install to see the command surface and examples.

## Bootstrap

Initialize the home directory and default profile:

```bash
sla install
```

That creates:

```text
~/.sla/
  config.json
  default/
    SOUL.md
    memories/
      MEMORY.md
      USER.md
    skills/
      .usage.json
```

## Hermes Setup

Hermes mode is explicit per invocation. Use `--hermes-agent` on every command that should target the Hermes home.

Initialize Hermes storage:

```bash
sla --hermes-agent install
```

That creates:

```text
~/.hermes/
  config.json
  profiles/
    default/
      SOUL.md
      memories/
        MEMORY.md
        USER.md
      skills/
        .usage.json
```

Create and use Hermes profiles:

```bash
sla --hermes-agent profile create research
sla --hermes-agent profile list
sla --hermes-agent profile context research --json
```

Hermes skills are category-aware and default to `general` when `--category` is omitted:

```bash
sla --hermes-agent skill create deploy research
sla --hermes-agent skill create deploy research --category ops
sla --hermes-agent skill view deploy research
sla --hermes-agent skill view deploy research --category ops
```

Install the Hermes host wrappers into the default Hermes profile:

```bash
sla --hermes-agent host install hermes
```

Install them into a specific existing Hermes profile:

```bash
sla --hermes-agent host install hermes --hermes-profile research
```

Hermes host install writes these wrapper skills under the selected profile:

- `skills/general/sla-use-profile`
- `skills/general/sla-create-profile`
- `skills/general/sla-update-profile`

Hermes host install does not install hooks and does not modify repository config.

## Quickstart

Use `sla help` as the primary entrypoint:

```bash
sla help
sla help profile create
sla help memory add
```

Common flows:

```bash
sla profile create research
sla soul view research
sla memory add research --target memory --entry "The API runs in us-east-1"
sla skill create deploy research
sla skill create-reference deploy research --path release-flow.md --title "Release Flow"
sla stats profile research
sla persistence activity
sla host install codex
sla host install claude
sla host install cursor
sla host install codex .
sla host install claude .
sla host install cursor .
sla host install codex . --gitignore
sla host install claude . --gitignore
sla host install cursor . --gitignore
sla host install codex --repository ~/development/self-learning-agent
sla host install claude --repository ~/development/self-learning-agent
sla host install cursor --repository ~/development/self-learning-agent
```

## Repository session profiles

To load one or more existing SLA profiles when working anywhere inside a repository, create a repository-local `.sla` manifest:

```bash
sla session install --profile research
sla session install --profile research --profile shared-engineering
sla session bootstrap --json
```

The manifest stores ordered profile names only; it never stores profile content, credentials, or provider settings:

```json
{
  "schemaVersion": 1,
  "profiles": ["research", "shared-engineering"]
}
```

`session install` validates that every named profile already exists. It writes `.sla` in the current directory and refuses to overwrite one without `--yes` (or an interactive confirmation). If that directory already has a `.gitignore`, it appends `.sla` once; it does not create a new `.gitignore`.

`session bootstrap [directory] --json` walks up from the supplied directory and uses the nearest `.sla` file. It returns the selected profiles and their canonical bootstrap contexts. A repository without `.sla` returns `found: false`; SLA does not silently substitute the global default profile. Commit `.sla` only when its selected profile names are suitable for collaborators.

For Codex, install the host integration once with `sla host install codex`. Its managed `SessionStart` hook loads the repository manifest during startup, resume, clear, and compaction without creating a user-visible continuation. The injected context includes the configured profiles and a compact skill index; view a relevant skill explicitly with `sla skill view <skill> <profile>`. `/use-profile` remains available when a user intentionally overrides or adds a profile.

Malformed manifests and unavailable configured profiles silently produce no SessionStart context so hook diagnostics do not reveal local paths or profile details. Remove SLA-managed Codex hooks and the custom persistence-review agent with `sla host uninstall-hooks codex`; unrelated hooks and skills are preserved.

### Manual Codex SessionStart verification

This read-only procedure requires an existing non-empty profile and refuses to choose one implicitly:

```bash
export SLA_LIFECYCLE_EXISTING_PROFILE=research
node scripts/verify-codex-session-start.js > /tmp/sla-before.json
sla session bootstrap --json
```

Create a disposable repository, write a temporary `.sla` containing that profile name, and install the Codex hook there with `sla host install codex --repository . --yes`. Start or resume Codex from that directory, then compare its injected SessionStart context to `sla profile context "$SLA_LIFECYCLE_EXISTING_PROFILE" --json`. Finally rerun `node scripts/verify-codex-session-start.js` and compare it to `/tmp/sla-before.json`; SessionStart itself does not mutate profile data.

Common Hermes flows:

```bash
sla --hermes-agent profile create research
sla --hermes-agent soul view research
sla --hermes-agent memory add research --target memory --entry "The API runs in us-east-1"
sla --hermes-agent skill create deploy research
sla --hermes-agent skill create-reference deploy research --path release-flow.md --title "Release Flow"
sla --hermes-agent skill write-file deploy research --category ops --subdir references --path rollback.md --stdin
sla --hermes-agent stats profile research
sla --hermes-agent host install hermes
sla --hermes-agent host install hermes --hermes-profile research
```

`sla host install codex` installs:

- Codex skills under `~/.codex/skills/`
- managed Stop and SessionStart hook scripts under `~/.codex/hooks/` by default, or under `<repository>/.codex/hooks/` when `--repository` is provided
- a merged hooks config at `~/.codex/hooks.json` by default, or at `<repository>/.codex/hooks.json` when `--repository` is provided
- repository-local installs write a portable hook command using global `node` and a relative `.codex/hooks/...` path so the config can be committed across machines
- when `--gitignore` is provided for a repository-local install and the repo already has a `.gitignore`, append `.codex/` if it is not already ignored
- a concise stop hook that asks the resumed root agent to dispatch one persistence-review child before ending a turn

The Stop hook asks the resumed root agent to dispatch exactly one `sla-persistence-review` custom agent. The root agent does not announce that dispatch or emit a progress update: after the child finishes, it returns only the child's concise result line. That child receives the session snapshot and active repository-profile scope, uses only `sla` CLI commands for warranted durable memory, skill, and reference updates, and returns an aggregate result only. It skips temporary, duplicate, ambiguous, or unsafe material; it never chooses a default profile by guesswork or exposes transcript contents or credentials in its outcome.

Each child result is recorded as a concise, redacted local activity record. Inspect recent outcomes with `sla persistence activity` (or filter with `sla persistence activity <profile>`). Records contain only profile names, outcome, mutation counts, an optional stable dispatch ID, and a fixed safe failure code—never transcript content, file paths, credentials, or arbitrary error text. A supplied dispatch ID is idempotent, so retrying the same identified delivery does not create a second activity record. The review child does not blindly retry failed writes; it reports a safe failure instead.

### Manual Codex persistence-dispatch verification

This opt-in check invokes Codex and may consume account usage. It uses temporary SLA, Codex, and repository directories only. Its hook and custom-agent installation is user-level within the temporary Codex home, so the check does not depend on trusting a newly created repository-local `.codex` directory. It copies file-backed local Codex authentication into that temporary home for the duration of the check; the temporary home is removed on completion, and an existing `CODEX_ACCESS_TOKEN` or `OPENAI_API_KEY` is used directly instead.

```bash
SLA_PERSISTENCE_DISPATCH_CHECK=1 node scripts/verify-codex-persistence-dispatch.js
```

Set `SLA_PERSISTENCE_DISPATCH_KEEP_TEMP=1` to retain those disposable directories for diagnostics; delete the printed directory when finished because it may contain a temporary copy of file-backed Codex authentication.

`sla host install cursor` installs:

- Cursor skills under `~/.cursor/skills/`
- a managed stop-hook script under `~/.cursor/hooks/` by default, or under `<repository>/.cursor/hooks/` when `--repository` is provided
- a merged hooks config at `~/.cursor/hooks.json` by default, or at `<repository>/.cursor/hooks.json` when `--repository` is provided
- repository-local installs write a portable hook command using global `node` and a relative `.cursor/hooks/...` path so the config can be committed across machines
- when `--gitignore` is provided for a repository-local install and the repo already has a `.gitignore`, append `.cursor/` if it is not already ignored
- a stop hook that injects one final Cursor follow-up message for SLA persistence review before the agent finishes

`sla host install claude` installs:

- Claude Code skills under `~/.claude/skills/` (or under `CLAUDE_CONFIG_DIR/skills/` when set)
- a managed stop-hook script under `~/.claude/hooks/` and an entry in `~/.claude/settings.json` by default
- for `--repository`, the hook script and merged settings live in `<repository>/.claude/hooks/` and `<repository>/.claude/settings.json`
- repository-local installs use the portable command `node .claude/hooks/sla-stop-hook.js`
- with `--gitignore`, appends `.claude/` to an existing repository `.gitignore` when needed

## JSON Output

All user-facing commands support `--json` for machine-readable output:

```bash
sla profile list --json
sla memory view research --target user --json
sla stats --json
```

Errors also render as structured JSON when `--json` is used.

## Release Check

Before publishing:

```bash
npm test
npm pack --dry-run
npm pack
```

The package intentionally publishes only runtime files plus this README and the license. `PLAN.md`, tests, and local analysis notes are excluded from the tarball.
