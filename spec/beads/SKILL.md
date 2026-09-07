---
name: spec-beads
description: Translate an approved spec issue plan into a safe, validated Beads issue graph. Use when Beads is the selected tracker for spec-created epics, features, tasks, bugs, dependencies, or QA work; do not use for product discovery or implementation itself.
---

# spec:beads

Use Beads only after `spec:build` has passed its discovery and issue-plan gates. `spec:beads` is the human-facing name; its portable skill identifier is `spec-beads`.

This adapter is based on the locally verified `bd` 1.2.2 CLI. Beads evolves, so run `bd <command> --help` before relying on a command whose flags matter to the current task.

## Safety and preflight

1. Confirm the target repository or Beads database with the human. Do not infer it from the current directory when multiple targets are possible.
2. Run read-only context checks such as `bd version`, `bd prime`, `bd list --json`, and `bd ready --json` in that target.
3. Detect likely duplicate or overlapping issues before proposing creation. Report candidates to the human; do not automatically merge, close, or relate them.
4. Do not run `bd init`, `bd setup`, `bd hooks`, `bd migrate`, sync, or update commands unless the human explicitly asks. Those operations can change repository or tracker configuration.
5. Preserve the approved product-plan content. Tracker fields are an encoding of the plan, not permission to alter it.

## Parallel review, single-writer creation

Keep one coordinating agent accountable for the selected target, the approved plan, dry runs, issue creation, dependency wiring, and final verification. When helpful, create subagents only for independent, read-only checks: searching for duplicate or overlapping issues, confirming current CLI behavior from help output, reviewing how the approved plan maps to Beads fields, or independently inspecting the completed graph.

Each subagent must receive a bounded question and target scope, then return evidence, command output or source references, uncertainties, and suspected mismatches. It must not run `bd` commands that mutate state, edit plan artifacts, make approval decisions, or create, update, close, label, or link issues. The coordinating agent reconciles all findings, presents the one canonical preview to the human, and performs any approved writes serially.

Do not create subagents for a small issue graph or closely coupled checks; the single-writer workflow is deliberately sequential once creation begins.

## Map the approved plan to Beads

Beads supports `epic`, `feature`, `task`, `bug`, `chore`, and `decision` issue types. It has no native `story` or `qa` type. Use this mapping unless the human specifies a different team convention:

| Plan item | Beads type | Parent/link |
| --- | --- | --- |
| Multi-outcome delivery container | `epic` | Top-level, unless an approved parent exists |
| Product story | `feature` | Child of its epic when one exists |
| Independently sequenced technical work | `task` | Child of the enabled feature or epic |
| QA work | `task` | Child of the feature it verifies; use a human-approved QA label if labels are wanted |
| Confirmed defect | `bug` | Parent and dependencies based on the approved graph |
| Decision requiring durable tracking | `decision` | Link to affected work only after approval |

Place the product story description in `--description`, acceptance criteria in `--acceptance`, and confirmed technical design in `--design`. Use `--parent` to create hierarchy. A parent relation does not replace a blocking dependency.

## Preview, create, and wire

Always perform these actions in sequence:

1. Render the proposed graph in conversation: exact titles, types, parents, dependencies, labels, and QA links.
2. Preview each planned creation with `bd create ... --dry-run`. For a larger graph, use Beads' approved batch/graph input only after validating its current CLI help and showing the generated input to the human.
3. Ask for the creation-gate approval, naming the exact target.
4. Save generated multi-line issue bodies, dry-run output, and the creation report in the active `~/.spec/<spec-slug>/tracker/` workspace. Do not overwrite an approved artifact.
5. Create parent issues before children and capture each returned ID. Use `--json` or `--silent` when reliable ID capture is needed.
6. Add only approved dependencies. In Beads, `bd dep add <blocked-id> <blocker-id>` means the first issue depends on the second, so the second must be completed first.
7. Verify every created item with `bd show <id>` and inspect the graph with `bd dep tree <id>` or equivalent read-only commands.
8. Run `bd dep cycles` after wiring dependencies. Resolve nothing automatically if a cycle or mismatch appears; report it to the human.

Keep issue creation repeatable: if a command fails midway, inspect the current tracker state before retrying. Never blindly rerun a batch create.

## QA and separate repositories

QA is optional. If the human wants it, create a linked child task in the same Beads target by default. If tests or QA tracking must be in another repository, ask the human for the exact repository/database and approved cross-reference method. Beads supports an `--external-ref` field and a `--repo` target override, but do not choose either without confirmation.

## Validate sequencing with Beads Viewer

`bv` is a read-oriented graph viewer. After creation, use its robot output only to inspect the result, for example `bv --robot-plan --format json` or `bv --robot-graph --graph-format mermaid` when those commands are available locally. Do not run its update or agent-file management actions as part of this skill.

## Report back

Return a creation report with:

- target repository/database and Beads version
- created IDs, titles, and types
- hierarchy and blocking links
- Beads cycle-check and viewer validation outcome
- QA links and test location, if applicable
- remaining open questions, skipped items, and any command that was not executed

Read [the verified command notes](references/commands.md) for the local command contract and examples.
