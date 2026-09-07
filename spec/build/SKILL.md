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
- `01-specification.md` — approved product specification and decisions
- `02-issue-plan.md` — approved issue hierarchy, ordering, dependencies, and QA choice
- `research.md` — sources, alternatives, findings, and unconfirmed recommendations when research was performed
- `tracker/` — generated description/design files, dry-run output, and creation reports for the selected tracker

Draft artifacts must identify their approval status. Do not overwrite a human-approved artifact; create a clearly named revision and return to the relevant approval gate.

## Core contract

- Do not guess requirements, policy, user behavior, technical choices, ownership, estimates, or tracker details. Mark an unsupported statement as an **Open question**, **Assumption requiring confirmation**, or **Research finding**, as appropriate.
- Do not create, edit, or close tracker issues until the human has completed every approval gate below and explicitly asks for creation.
- Keep product intent and technical execution distinct. Product language explains the value and observable outcome; technical work describes the implementation needed to deliver it.
- Treat acceptance criteria and failure paths as testable expected results, not promises about an unverified implementation.
- Use local context first: the requirement, conversation, repository instructions, architecture, existing tests, current issues, and project documentation. Never alter the repository during discovery unless the human asks.

## Run the discovery

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

## Research

Inspect relevant local code and documentation before proposing technical approaches. Research the web when the human requests it, when current external facts materially affect the decision, or when comparing established approaches would improve the spec. Do not send confidential repository or business details to external search.

Present research as options with evidence, trade-offs, and a recommendation. A recommendation is not a decision: ask the human to confirm it before it becomes part of the specification or an issue.

## Parallel research and discovery

Keep one coordinating agent responsible for the human conversation, the discovery record, recommendations, approval gates, and the final issue plan. When the investigation contains independent, bounded questions whose answers would materially reduce wait time, create subagents for read-only research in parallel. Suitable work includes separately inspecting existing code and tests, project documentation and architecture, relevant external documentation, dependencies, risks, or comparable implementation options.

Give each subagent one explicit question, a defined scope, and a request to return evidence, sources, uncertainties, and any conflicts with the stated goal. Subagents must not edit repository or spec artifacts, make tracker changes, speak for the human, or turn recommendations into decisions. The coordinating agent reconciles their findings, records unresolved conflicts as open questions, and presents one coherent discovery summary for human approval.

Do not delegate when the work is small, sequential, overlapping, or needs repeated human clarification; coordination overhead would outweigh the benefit.

## Approval gates

Use these gates in this order. State the gate and wait for an unambiguous human approval before proceeding.

1. **Discovery gate** — Present the working problem statement, confirmed facts, scope, unresolved questions, and any proposed research. Obtain confirmation that the discovery summary represents the intended problem.
2. **Issue-plan gate** — Present the proposed hierarchy, issue types, dependencies, sequencing, acceptance criteria, technical work, and QA approach. Obtain approval of the issue plan.
3. **Creation gate** — Show the tracker-specific dry run or equivalent preview and the exact target repository/project. Create issues only after the human explicitly authorizes the write.

If feedback invalidates an approved decision, return to the appropriate earlier gate. Never silently revise approved scope.

## Build the specification and issue plan

After discovery approval, create a human-readable specification before tracker mutation. Read [the issue model](references/issue-model.md) when drafting it.

Use an epic only when it groups multiple independently deliverable outcomes, a meaningful release slice, or a cross-cutting goal. Otherwise start with a product story or bug.

For each product story, include product-oriented content in the story itself:

- user or stakeholder, problem, and desired outcome
- scope and non-goals
- priority when the human has confirmed it
- concrete acceptance criteria
- happy paths and unhappy, validation, boundary, or recovery paths
- dependencies, risks, and observable completion result

Use linked technical tasks only when the technical work is independently assignable, reviewable, sequenced, or blocks other work. Put small implementation notes in the product story rather than creating work for its own sake. Technical tasks must identify the confirmed approach, impacted systems or contracts, migration/operational concerns when applicable, and required automated coverage.

Create a linked QA task only if the human opts in. Ask where the tests should live if that cannot be inferred from the repository or conversation. When testing belongs in another repository or tool, require the human to identify the target and linking method; do not infer either.

Order work by real blocking relationships, not merely preferred reading order. Foundation or decision work that blocks a story comes first; a story blocks its QA task; unrelated work stays parallel. Explain the dependency graph in plain language before creating it.

## Tracker selection

Ask for the issue tracker on first use unless it is already confirmed. Select the matching `spec:{tracker}` adapter. For Beads, load and follow the sibling `spec:beads` skill at `../beads/SKILL.md` before reading or writing tracker state.

Keep the tracker adapter separate from the product specification: the same approved plan must remain portable to future tracker skills.

## Handoff

Before creation, provide a concise plan containing the approval status, tracker target, ordered issues, dependencies, open questions, and QA decision. After creation, report the created issue IDs, parent/child links, blocking links, and anything intentionally not created.

Never claim that an issue graph, test plan, or implementation is complete without verifying the relevant result.
