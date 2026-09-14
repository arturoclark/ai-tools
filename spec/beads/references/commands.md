# Verified Beads command notes

These notes came from the local Homebrew installation on 2026-09-06:

```text
bd version 1.2.2 (Homebrew)
```

Run current command help before execution. The commands below document the observed contract, not a replacement for the installed CLI's help.

## Read and inspect

```sh
bd version
bd prime
bd list --json
bd ready --json
bd show <id>
bd dep tree <id>
bd dep cycles
```

`bd list` supports title, type, status, label, parent, and priority filters, including `--title`, `--type`, `--parent`, and global `--json`. Use narrow filters to look for duplicates before creation.

## Create

```sh
bd create "<title>" \
  --id DEV-0000 \
  --type <epic|feature|task|bug|chore|decision> \
  --priority <P0-P4> \
  --description "<approved product content>" \
  --acceptance "<approved acceptance criteria>" \
  --design "<confirmed technical design>" \
  --parent <parent-id> \
  --dry-run
```

Replace `DEV-0000` with the next unused four-digit `DEV-####` ID, calculated from the greatest existing exact `DEV-####` ID in the confirmed target. Remove `--dry-run` only after the human has approved the issue plan and that approval is recorded in `02-issue-plan.md`. Prefer a body or design file for multi-line descriptions when the current environment makes shell quoting unsafe. Do not use `--force` to bypass an ID-prefix mismatch. `bd create` also supports `--body-file`, `--design-file`, `--labels`, `--metadata`, `--spec-id`, `--external-ref`, `--repo`, `--json`, and `--silent`.

## Dependencies

```sh
bd dep add <blocked-id> <blocker-id>
```

The issue in the first position depends on the issue in the second position. Example: `bd dep add qa-issue feature-issue` means the QA issue is blocked by the feature.

Use `bd dep add --help` immediately before writing dependencies if the plan uses a non-default dependency type or bulk operation.

## Viewer validation

```sh
bv --robot-plan --format json
bv --robot-graph --graph-format mermaid
```

The installed `bv` binary exposes robot planning and graph output. Its available flags may change; confirm with `bv --help` or `bv --robot-help`. Do not use `--update`, `--agents-add`, `--agents-remove`, or `--agents-update` without an explicit request.
