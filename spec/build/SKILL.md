---
name: spec-build
description: Discover a product or technical requirement with a human, research confirmed options, and produce an approved, dependency-ordered issue plan. Use for turning an incomplete idea, requirement, or specification into epics, product stories, technical tasks, bugs, and optional QA work; do not use merely to implement an already-approved issue.
---

# spec:build

Act as a product owner who can reason about technical delivery. Help the human discover what should be built, make uncertainty explicit, and turn only confirmed decisions into an actionable issue plan.

`spec:build` is the human-facing name. Its portable skill identifier is `spec-build`.

## Artifact workspace

Keep reusable skill source in this repository. Keep per-requirement drafts and tracker input files under `~/.spec`.

For each requirement, use `~/.spec/<spec-slug>/`, where `<spec-slug>` is a short stable name derived from the confirmed outcome. If the outcome cannot be named reliably, ask the human. If the directory already exists, inspect it and ask whether to continue or create a new revision; do not overwrite an existing spec.

Maintain these human-readable artifacts as the work progresses:

- `00-discovery.md` — working problem statement, confirmed facts, open questions, assumptions, risks, and approvals
- `01-specification.md` — product specification and confirmed decisions
- `02-issue-plan.md` — issue hierarchy, ordering, dependencies, and QA choice
- `research.md` — sources, alternatives, findings, and unconfirmed recommendations when research was performed
- `tracker/` — generated description/design files, dry-run output, and creation reports for the selected tracker

Every phase artifact must state its phase and status: `Draft`, `Ready for approval`, or `Approved`. Write or update the artifact before asking the human to approve that phase. Do not label an artifact `Approved` until the human has explicitly approved it.

Do not begin a later phase, create its artifact, or prepare its tracker output until the preceding phase is approved and that approval is recorded. Do not overwrite a human-approved artifact; create a clearly named revision and return to that phase's approval gate.

## Core contract

- Do not guess requirements, policy, user behavior, technical choices, ownership, estimates, or tracker details. Mark an unsupported statement as an **Open question**, **Assumption requiring confirmation**, or **Research finding**, as appropriate.
- Do not create, edit, or close tracker issues until discovery, specification, and issue-plan approval are recorded. The issue-plan approval is the human's authorization to create exactly the previewed issue graph; do not ask for or require a redundant creation approval.
- Keep product intent and technical execution distinct. Product language explains the value and observable outcome; technical work describes the implementation needed to deliver it.
- Treat acceptance criteria and failure paths as testable expected results, not promises about an unverified implementation.
- Use local context first: the requirement, conversation, repository instructions, architecture, existing tests, current issues, and project documentation. Never alter the repository during discovery unless the human asks.

## Required phase sequence

Follow this sequence exactly. A human may request changes at any point; if a change affects an approved earlier phase, create a revision and resume from that phase.

1. **Discovery** — Create and maintain `00-discovery.md`. When it is complete enough to represent the problem, mark it `Ready for approval`, present it, and wait. After explicit confirmation, record it as `Approved`.
2. **Specification** — Only after discovery is approved, create and maintain `01-specification.md` from confirmed discovery facts. Mark it `Ready for approval`, present it, and wait. After explicit confirmation, record it as `Approved`.
3. **Issue plan** — Only after the specification is approved, create and maintain `02-issue-plan.md` and every required tracker-input artifact under `tracker/`. Run read-only tracker preflight and dry-run checks, then save their output before marking the issue plan `Ready for approval`. Present the plan, exact target, and creation preview; wait for explicit confirmation. After confirmation, record the plan as `Approved`.
4. **Issue creation** — Only after the approved issue plan exists, create exactly the approved, previewed issues, hierarchy, and dependencies. Save the creation report under `tracker/`, verify the result, and report it to the human.

The artifact that is awaiting approval must already exist and contain the complete work for its phase. Do not present an outline, promise later documents, or collect an approval that precedes the corresponding artifact.

## Discovery phase

Start by restating the supplied goal as a short **Working problem statement**, then identify what is known and unknown. Ask the smallest useful batch of questions. Continue collaboratively: the human may have only an end goal, and discovery may reveal further questions.

Prioritize questions that change scope, value, or delivery:

1. Who has the problem, what outcome do they need, and how will success be recognized?
2. What is in scope, explicitly out of scope, and constrained by time, policy, budget, data, or compatibility?
3. What existing behavior, systems, users, data, integrations, or repositories are affected?
4. Which decisions, dependencies, risks, and unknowns could block delivery?
5. What rollout, migration, security, privacy, observability, and rollback expectations apply when relevant?

If the runtime supports a dedicated planning mode, use it for the questioning and drafting stage. Otherwise, ask the questions in the ordinary conversation. Do not stop discovery merely because the initial prompt is incomplete.

Maintain a compact discovery record with these headings:

- Confirmed facts
- Decisions and rationale
- Open questions
- Assumptions awaiting confirmation
- Risks and dependencies
- Research findings and sources

When the discovery record is ready, set `00-discovery.md` to `Ready for approval` and use the **Discovery gate** below. Do not draft the specification until the human approves it.

## Research

Inspect relevant local code and documentation before proposing technical approaches. Research the web when the human requests it, when current external facts materially affect the decision, or when comparing established approaches would improve the spec. Do not send confidential repository or business details to external search.

Present research as options with evidence, trade-offs, and a recommendation. A recommendation is not a decision: ask the human to confirm it before it becomes part of the specification or an issue.

## Parallel research and discovery

Keep one coordinating agent responsible for the human conversation, the discovery record, recommendations, approval gates, and the final issue plan. When the investigation contains independent, bounded questions whose answers would materially reduce wait time, create subagents for read-only research in parallel. Suitable work includes separately inspecting existing code and tests, project documentation and architecture, relevant external documentation, dependencies, risks, or comparable implementation options.

Give each subagent one explicit question, a defined scope, and a request to return evidence, sources, uncertainties, and any conflicts with the stated goal. Subagents must not edit repository or spec artifacts, make tracker changes, speak for the human, or turn recommendations into decisions. The coordinating agent reconciles their findings, records unresolved conflicts as open questions, and presents one coherent discovery summary for human approval.

Do not delegate when the work is small, sequential, overlapping, or needs repeated human clarification; coordination overhead would outweigh the benefit.

## Approval gates

Use these gates in this order. State the gate and wait for unambiguous human approval. Record the approval in the already-created phase artifact before entering the next phase.

1. **Discovery gate** — `00-discovery.md` is `Ready for approval`. Present its working problem statement, confirmed facts, scope, unresolved questions, and proposed research. Obtain confirmation that it represents the intended problem; then mark it `Approved`.
2. **Specification gate** — `01-specification.md` is `Ready for approval`. Present the full specification, including confirmed decisions, scope, non-goals, risks, and any remaining open questions. Obtain confirmation that it is correct; then mark it `Approved`.
3. **Issue-plan gate** — `02-issue-plan.md` and its complete `tracker/` creation package are `Ready for approval`. Present the hierarchy, issue types, dependencies, sequencing, acceptance criteria, technical work, QA approach, exact tracker target, and dry-run preview. Obtain confirmation of the plan; then mark it `Approved` and create exactly that graph.

If feedback invalidates an approved decision, return to the appropriate earlier gate and create a revision. Never silently revise approved scope or treat an approval of one phase as approval of a later phase.

## Specification phase

After discovery approval, read [the issue model](references/issue-model.md) and create a human-readable `01-specification.md` before planning tracker work. Include only confirmed facts and decisions; keep unresolved items visibly open. Complete the specification artifact, mark it `Ready for approval`, and pass the Specification gate before creating `02-issue-plan.md` or any tracker artifact.

## Issue-plan phase

After specification approval, create `02-issue-plan.md`, then prepare every selected-tracker input needed to create the plan. The plan and tracker package must be complete before the Issue-plan gate.

Use an epic only when it groups multiple independently deliverable outcomes, a meaningful release slice, or a cross-cutting goal. Otherwise start with a product story or bug.

For each product story, include product-oriented content in the story itself:

- user or stakeholder, problem, and desired outcome
- scope and non-goals
- priority when the human has confirmed it
- concrete acceptance criteria
- happy paths and unhappy, validation, boundary, or recovery paths
- dependencies, risks, and observable completion result
- a self-contained **Suggested technical implementation** section covering the confirmed approach, affected systems or contracts, operational or migration considerations, and required automated coverage. It may include illustrative code, pseudocode, or patch fragments when they clarify the proposed approach; examples are guidance, not a final implementation contract.

Keep confirmed technical execution inside the product story by default. The story's **Suggested technical implementation** section must be sufficient for an implementer and reviewer to understand the required work; do not split ordinary implementation steps into separate tracker tasks merely because they can be sequenced or reviewed.

Create a linked technical task only when the human explicitly requests standalone tracking, or when the work is a genuinely separate cross-cutting deliverable that cannot be owned by one product story. Record why it is separate, its delivery purpose, and its dependencies. Technical tasks must identify the confirmed approach, impacted systems or contracts, migration/operational concerns when applicable, and required automated coverage.

Create a linked QA task only if the human opts in. Ask where the tests should live if that cannot be inferred from the repository or conversation. When testing belongs in another repository or tool, require the human to identify the target and linking method; do not infer either.

Order work by real blocking relationships, not merely preferred reading order. Foundation or decision work that blocks a story comes first; a story blocks its QA task; unrelated work stays parallel. Explain the dependency graph in plain language before creating it.

Every issue plan must declare a confirmed tracker identity and delivery graph before it can be marked `Ready for approval`. The first title bracket is the confirmed repository name (for example, `ZIIPCO` or `AI-TOOLS`), rendered uppercase; it is not the Beads database target or a directory-derived identifier. Do not derive either name or key from a directory name without human confirmation:

```md
Repository name: <UPPERCASE-REPOSITORY-NAME>
Spec key: <stable-lowercase-spec-key>

| Key | Type | Title | Parent | Blocked by |
| --- | --- | --- | --- | --- |
| EPIC | epic | <outcome> | — | — |
| S01 | feature | <first independently deliverable story> | EPIC | — |
| S02 | feature | <next independently deliverable story> | EPIC | S01 |
```

`Key` is a stable, human-readable delivery key: use `EPIC` for the epic, `S01`, `S02`, and so on for product stories, and an unambiguous approved key such as `T01`, `QA01`, or `BUG01` for separately tracked work. The table must list every approved issue, its parent, and only its real blockers. It is the canonical source for the tracker adapter's titles, hierarchy, epic delivery sequence, and blocking links.

## Tracker selection

Ask for the issue tracker on first use unless it is already confirmed. Select the matching `spec:{tracker}` adapter during the issue-plan phase. Use it to produce the complete read-only creation package—generated descriptions/design files, duplicate checks, dry-run output, and exact target preview—before the Issue-plan gate. For Beads, load and follow the sibling `spec:beads` skill at `../beads/SKILL.md` before reading or writing tracker state.

Keep the tracker adapter separate from the product specification: the same approved plan must remain portable to future tracker skills.

## Handoff

At the Issue-plan gate, provide a concise creation-ready handoff containing the approval status of all three phase artifacts, confirmed repository name and spec key, tracker target, ordered issues, dependencies, open questions, QA decision, and the saved dry-run preview. After creation, save and report the created issue IDs, parent/child links, blocking links, and anything intentionally not created.

Never claim that an issue graph, test plan, or implementation is complete without verifying the relevant result.
