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
- a managed stop-hook script under `~/.codex/hooks/` by default, or under `<repository>/.codex/hooks/` when `--repository` is provided
- a merged hooks config at `~/.codex/hooks.json` by default, or at `<repository>/.codex/hooks.json` when `--repository` is provided
- repository-local installs write a portable hook command using global `node` and a relative `.codex/hooks/...` path so the config can be committed across machines
- when `--gitignore` is provided for a repository-local install and the repo already has a `.gitignore`, append `.codex/` if it is not already ignored
- a stop hook that prompts Codex for one final persistence pass before ending a turn

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
