---
name: spec-beads
description: Translate an approved spec issue plan into a safe, validated Beads issue graph. Use when Beads is the selected tracker for spec-created epics, features, tasks, bugs, dependencies, or QA work; do not use for product discovery or implementation itself.
---

# spec:beads

Use Beads read-only during `spec:build`'s issue-plan phase only after its discovery and specification gates have passed. Create or change Beads issues only after its issue-plan gate has passed and `02-issue-plan.md` is recorded as approved. `spec:beads` is the human-facing name; its portable skill identifier is `spec-beads`.

This adapter is based on the locally verified `bd` 1.2.2 CLI. Beads evolves, so run `bd <command> --help` before relying on a command whose flags matter to the current task.

## Safety and preflight

1. Confirm the target repository or Beads database with the human. Do not infer it from the current directory when multiple targets are possible.
2. Run read-only context checks such as `bd version`, `bd prime`, `bd list --json`, and `bd ready --json` in that target.
3. Detect likely duplicate or overlapping issues before proposing creation. Report candidates to the human; do not automatically merge, close, or relate them.
4. Do not run `bd init`, `bd setup`, `bd hooks`, `bd migrate`, sync, or update commands unless the human explicitly asks. Those operations can change repository or tracker configuration.
5. Preserve the approved discovery and specification content and the current issue-plan draft. Tracker fields are an encoding of the plan, not permission to alter it.
6. Confirm the issue-plan's repository name and spec key. The repository name is the uppercase first bracket in the title, not the filesystem location or Beads database target. Do not invent either from the filesystem or target database.

## Parallel review, single-writer creation

Keep one coordinating agent accountable for the selected target, the approved plan, dry runs, issue creation, dependency wiring, and final verification. When helpful, create subagents only for independent, read-only checks: searching for duplicate or overlapping issues, confirming current CLI behavior from help output, reviewing how the approved plan maps to Beads fields, or independently inspecting the completed graph.

Each subagent must receive a bounded question and target scope, then return evidence, command output or source references, uncertainties, and suspected mismatches. It must not run `bd` commands that mutate state, edit plan artifacts, make approval decisions, or create, update, close, label, or link issues. The coordinating agent reconciles all findings, presents the one canonical preview to the human, and performs any approved writes serially.

Do not create subagents for a small issue graph or closely coupled checks; the single-writer workflow is deliberately sequential once creation begins.

## Map the issue plan to Beads

Beads supports `epic`, `feature`, `task`, `bug`, `chore`, and `decision` issue types. It has no native `story` or `qa` type. Use this mapping unless the human specifies a different team convention:

| Plan item | Beads type | Parent/link |
| --- | --- | --- |
| Multi-outcome delivery container | `epic` | Top-level, unless an approved parent exists |
| Product story | `feature` | Child of its epic when one exists |
| Technical implementation for a product story | Included in its `feature` | Do not create a separate issue by default |
| Explicitly approved standalone or cross-cutting technical deliverable | `task` | Child of the enabled feature or epic |
| QA work | `task` | Child of the feature it verifies; use a human-approved QA label if labels are wanted |
| Confirmed defect | `bug` | Parent and dependencies based on the approved graph |
| Decision requiring durable tracking | `decision` | Link to affected work only after approval |

Make every feature self-contained in `--description`: include the product outcome, scope and non-goals, **Suggested technical implementation**, migration or operational considerations, and test expectations. The suggested-implementation section may include illustrative code, pseudocode, or patch fragments when useful; make clear that these examples are not the final implementation contract. Place acceptance criteria in `--acceptance`. `--design` may hold supplementary design detail, but must not be the only place required technical work appears because tracker views may not show it prominently. Use `--parent` to create hierarchy. A parent relation does not replace a blocking dependency.

Before the preview, reconcile each planned technical item: embed ordinary implementation work in its parent feature description, or create a `task` only when the plan explicitly calls for standalone tracking or identifies a separate cross-cutting deliverable. Do not silently turn embedded work into separate tasks or hide required work only in `--design`.

## Identity, titles, and IDs

The issue-plan table is required. Its `Repository name`, `Spec key`, and per-item `Key` determine each Beads title exactly. The first bracket is the uppercase repository name:

```text
[<REPOSITORY-NAME>][<spec-key>][<KEY>] <approved issue title>
```

Examples:

```text
[AI-TOOLS][sla-persistence][EPIC] Persist Codex SLA learning
[AI-TOOLS][sla-persistence][S01] Dispatch SLA persistence review
```

The bracketed identity is title text, not a replacement for Beads' type, parent, labels, or dependency fields. Create the first example with `--type epic`; create the second with `--type feature --parent <epic-id>`. Use the approved `Key` verbatim, including `EPIC`, `S01`, `S02`, `T01`, `QA01`, or `BUG01`.

Create every issue with an explicit ID in the form `DEV-0000`, where the numeric suffix is four digits. Before each preview and each creation, inspect the selected target with `bd list --json`; select one greater than the greatest existing ID that exactly matches `DEV-<four digits>`. Start at `DEV-0000` only when no such ID exists. Do not derive the next number from dotted child IDs, non-numeric IDs, timestamps, display order, or a different repository/database. Create serially so two planned issues cannot receive the same ID. If the selected target rejects the `DEV-` prefix or the next ID is already occupied, stop and report the mismatch rather than using `--force` or falling back to an automatically generated ID.

Pass the computed ID with `bd create --id <DEV-####>`. After creation, verify that the returned ID exactly matches the planned ID. This convention applies to epics and children alike; `--parent` expresses hierarchy and must not change the child ID format.

## Epic delivery sequence

Every epic description must include these sections, populated from the issue-plan table before previewing creation:

```md
## Delivery sequence

1. S01 — <first story title>
2. S02 — <second story title>

## Blocking relationships

- S02 is blocked by S01.
```

List every child issue in its real delivery sequence, including approved standalone tasks or QA work when applicable. State only actual blockers in **Blocking relationships**; write `- None.` when there are no blocking relationships. Use the stable plan keys rather than future Beads IDs, which do not exist while the epic description is authored. The epic narrative does not replace the actual `bd dep add` links.

## Prepare, approve, create, and wire

Keep the read-only preparation and the write strictly separate.

Before the issue-plan gate, while `02-issue-plan.md` is still a draft:

1. Render the proposed graph in conversation: repository name, spec key, plan key, exact `DEV-####` ID, exact title, type, parent, dependencies, labels, and QA links.
2. Save generated multi-line issue bodies and design files in `~/.spec/<spec-slug>/tracker/`, then preview every planned creation with its explicit `--id DEV-####` and `bd create ... --dry-run`. For a larger graph, use Beads' approved batch/graph input only after validating its current CLI help and showing the generated input to the human.
3. Save dry-run output and the exact-target preview beside the generated inputs. The complete package must exist before the plan is marked `Ready for approval`.
4. Do not create, update, close, label, or link any issue at this stage.

After the human approves the issue plan, verify that the approved plan and saved preview still match. That approval authorizes the following writes; do not ask for a separate creation gate:

5. Create parent issues before children and capture each returned ID. Use `--json` or `--silent` when reliable ID capture is needed.
6. Add only approved dependencies. In Beads, `bd dep add <blocked-id> <blocker-id>` means the first issue depends on the second, so the second must be completed first.
7. Verify every created item with `bd show <id>` and inspect the graph with `bd dep tree <id>` or equivalent read-only commands.
8. Run `bd dep cycles` after wiring dependencies. Resolve nothing automatically if a cycle or mismatch appears; report it to the human.
9. Save the creation report in the active `~/.spec/<spec-slug>/tracker/` workspace. Do not overwrite an approved artifact.

Keep issue creation repeatable: if a command fails midway, inspect the current tracker state before retrying. Never blindly rerun a batch create.

## QA and separate repositories

QA is optional. If the human wants it, create a linked child task in the same Beads target by default. If tests or QA tracking must be in another repository, ask the human for the exact repository/database and approved cross-reference method. Beads supports an `--external-ref` field and a `--repo` target override, but do not choose either without confirmation.

## Validate sequencing with Beads Viewer

`bv` is a read-oriented graph viewer. After creation, use its robot output only to inspect the result, for example `bv --robot-plan --format json` or `bv --robot-graph --graph-format mermaid` when those commands are available locally. Do not run its update or agent-file management actions as part of this skill.

## Report back

Return a creation report with:

- target repository/database and Beads version
- created IDs, titles, types, and confirmation that every ID matches `DEV-####`
- hierarchy and blocking links
- Beads cycle-check and viewer validation outcome
- QA links and test location, if applicable
- remaining open questions, skipped items, and any command that was not executed

Read [the verified command notes](references/commands.md) for the local command contract and examples.
