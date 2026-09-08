---
name: spec-implement
description: Load a Beads issue with its approved spec context before implementing it. Use when asked to work on a tracked issue; do not use to discover requirements or create issues.
---

# spec:implement

Prepare a tracked issue for implementation by loading the issue from its Beads target and the approved specification that produced it. Then implement only the confirmed work in the current code workspace.

`spec:implement` is the human-facing name. Its portable skill identifier is `spec-implement`.

## Inputs and boundaries

The normal request names an issue ID. It may also name the source-spec directory.

- The Beads target is supplied globally through `BEADS_DIR`. Validate that it is set and points to the expected directory before reading tracker state. Do not infer a target from the current implementation workspace, ask for a per-session path, or create a local target registry.
- If no issue ID is supplied, inspect `bd ready --json` in the confirmed target and present the available items for the human to select. Do not choose one based on priority, title, or order.
- Do not create, modify, close, label, assign, sync, or otherwise mutate tracker state. A separate tracker request and its applicable skill are required for that.

## Read the tracker issue

Work from the `BEADS_DIR` target and treat the selected issue's tracker fields as the delivery contract.

1. Run read-only context checks appropriate to the installed Beads version, including `bd version`, `bd prime`, and `bd show <issue-id>`. Read current command help before relying on flags whose behavior matters.
2. Read the issue title, type, status, description, acceptance criteria, design, parent, labels, dependencies, and external or spec references. Inspect its dependency tree and whether it is ready. If it has an unresolved blocker, explain the blocker and do not start dependent implementation unless the human explicitly redirects the work.
3. Preserve the exact issue ID and title in the implementation brief. Do not treat a parent relation as proof that its children are ready, and do not infer missing acceptance criteria.

## Resolve and read the source specification

Look for the specification in this order:

1. An explicit spec path or spec reference supplied by the human or shown on the issue.
2. The issue title identity, when it has the form `[REPOSITORY][spec-key][issue-key] …`. Search `~/.spec/` for artifacts whose declared `Spec key` or issue-plan entry matches that identity.
3. The associated tracker artifacts under the matching `~/.spec/<spec-slug>/tracker/`, when they clarify the created issue body or dry-run.

Read the matching `01-specification.md` and `02-issue-plan.md`; also read the exact issue's generated tracker body when available. Use `00-discovery.md` only for confirmed decisions, unresolved questions, and constraints that materially affect this issue. Do not load unrelated specs merely because they share a repository name.

Before treating a spec as authoritative, verify its recorded approval status. If it is missing, unapproved, ambiguous, or conflicts with the current tracker issue, report the mismatch and ask the human to resolve it rather than selecting an interpretation. If the source spec cannot be located, say that the issue itself is the only available contract and ask the human for the spec location before relying on unstated requirements.

## Implement from a grounded brief

Create a compact working brief from the selected issue and its verified spec:

- intended outcome and acceptance criteria;
- in-scope work, non-goals, constraints, and affected interfaces;
- confirmed technical approach and expected automated coverage;
- blockers, dependencies, and unresolved questions; and
- sources read: issue ID, issue target, and spec artifact paths.

Inspect the implementation workspace's instructions, relevant code, tests, and local documentation before editing. Keep changes scoped to the brief. If a required decision or acceptance criterion is absent, stop and ask the human; do not fill it in from convention or guesswork. Run proportionate validation and report the result, including any tests that could not run.

At handoff, summarize the implementation, validation, and remaining questions. Suggest any tracker-status update, but leave it unchanged unless the human separately asks for it.
