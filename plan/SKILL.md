---
name: plan
description: Create repo-local implementation plans for features, refactors, migrations, and debugging work. Use when the user asks for a plan, wants a feature broken into verifiable parts, wants execution deferred until after planning, or needs a plan that includes frontend and backend verification, worktree branch rules, SLA profile handling, and repo test coverage.
---

# Plan

## Overview

Create a planning artifact only. Do not implement code, modify product files, or run mutating project commands other than creating or updating the plan markdown file itself.

If a required fact is missing and cannot be discovered from the repo or the current conversation, do not guess. Say: `I don't know, help me get more context`.

## Planning Mode

For the current turn:

- Plan only.
- Inspect the repo with read-only commands as needed.
- Do not edit app code, tests, configs, or docs outside the plan file.
- Do not create branches, worktrees, commits, or pull requests.
- Do not invent repo structure, test paths, branch names, or SLA profiles that are not in context.

If the runtime supports a dedicated plan mode, use it. Otherwise, follow this skill as the planning contract.

## What To Discover First

Before writing the plan, gather only the context needed to make the plan accurate:

1. Identify the repo root and current branch.
2. Check whether the repo already has a planning convention such as `plans/`, `docs/plans/`, or similar.
3. Check which repo test suites already exist, such as unit, integration, e2e, Playwright, Cypress, or other documented automated test workflows.
4. Check whether the user already provided:
   - the feature goal
   - the base branch to branch worktrees from
   - SLA profiles for implementation work
   - the relevant test commands, suites, or directories if they are not obvious

Ask only for missing information that is required to avoid guessing. Keep questions short and concrete. When asking about options, explain each option in natural language.

## Required Questions

Ask these when they are not already clear from context:

### Base branch

Ask which branch each part worktree should branch from. Record both:

- `Base branch`: the exact branch name
- `Base source`: where that branch should be pulled from, if the user specifies a remote or source branch

Do not default this from the current branch unless the user explicitly tells you to.

### SLA profiles

Ask whether the user wants to define SLA profiles now for implementing plan parts.

If the user provides profiles, record the exact values in the plan and instruct later implementers to use the `sla-use-profile` skill to load each recorded profile before starting the relevant work.

If the user does not provide profiles during planning, record that they must be requested at implementation time before work starts on each part, and that the `sla-use-profile` skill must be used once the profile is known.

### Tests

If the repo does not make the relevant test setup obvious, ask the user which test workflow should be used for this plan.

Record the test context in the plan:

- exact test commands or suites when known
- tests exist but exact commands still need confirmation
- new tests must be created as part of implementation
- test workflow must be requested before implementation

## Where To Save The Plan

Save the markdown file inside the repo in the most established planning location you can verify:

1. Use an existing repo `plans/` directory if present.
2. Otherwise use an existing `docs/plans/` directory if present.
3. Otherwise create `plans/` at the repo root and place the plan there.

Use a filename in this shape:

`YYYY-MM-DD-<plan-slug>.plan.md`

The slug should be short, stable, and feature-focused.

## Plan Structure

Every plan must use this structure.

```md
# <Feature Name> Plan

## Goal

## Scope and assumptions

## Execution context
- Repo root:
- Plan file:
- Current branch:
- Base branch:
- Base source:
- Implementation SLA profile(s):
- Test strategy/status:

## Worktree branch convention

## Parts

### Part 1: <Name>
Status: Pending
Completed at:
Worktree branch:

#### What to achieve

#### Technical details

#### Expected results

#### Verification
• Frontend
1. ...
   Expected result: ...

• Backend
1. ...
   Expected result: ...

#### Completion protocol

#### Tests to add or update

## Open questions
```

## Worktree Branch Convention

For each part, assign a planned worktree branch name using:

`<plan-slug>-part-<NN>`

Use a two-digit part number such as `01`, `02`, `03`.

Only add the date suffix `-YYYYMMDD` if a collision is likely or the repo already uses dated branch names.

Record the exact planned branch name for every part inside the plan.

## How To Break The Feature Down

Split the feature into parts that produce independently verifiable outcomes. A part is valid only when it has a concrete result that can be checked by frontend behavior, backend behavior, or both.

Use these rules:

- Keep each part coherent. Do not mix unrelated infrastructure, UI, and cleanup work unless they are required to verify the same outcome.
- Prefer vertical slices over layer-only buckets when the feature can be proven end to end.
- If a feature has required prerequisites, make those their own part only when the result is still independently testable.
- Keep parts large enough to matter, but small enough that a future implementer can complete and verify them without ambiguity.

## What Each Part Must Contain

### What to achieve

Write a natural-language description of the outcome for that part. Focus on what the system will be able to do after the part is complete.

### Technical details

Write the implementation guidance with enough detail for an agent to execute accurately. Include:

- likely files and modules to inspect or edit
- interfaces, data flow, and control flow changes
- migrations, generators, RPC surfaces, schemas, or contracts if relevant
- tests that should be added or updated, including unit, integration, e2e, or other repo-native automated coverage that fits the part
- observability, logging, or operational details if they matter

Be precise. This section is primarily for implementers and agents.

### Expected results

Describe in natural language what should be true when the part is finished. This should read like a concrete outcome, not like code instructions.

### Verification

Write a step-by-step verification section separated into frontend and backend flows when both apply.

The verification steps must explicitly include the tests that will be created or updated for that part.
Each part must include, in order when applicable, a step for creating or updating the test coverage and a step for running that coverage.
The automated tests must align with the same step-by-step behaviors described in `Verification`. If a human is expected to verify a behavior manually, the planned tests should cover that same behavior in automated form when feasible.

Format it exactly as readable numbered steps with inline expected results, for example:

```md
• Frontend

1. Start the app in your normal dev setup.

2. Open the relevant page or flow.
   Expected result: the page loads with the new state visible.

• Backend

3. Run the focused test file for this part.
   Expected result: the new and existing tests pass.

4. Run the end-to-end or integration coverage for this part, if applicable.
   Expected result: the user-facing flow passes without regressions.
```

Rules:

- Use natural language.
- Make each step observable by a human or agent.
- Include the expected result directly after the step it validates.
- Include explicit test-creation or test-update work in the steps when the part requires new coverage.
- Do not leave test work implied. The verification sequence must say what test will be added or changed, then say how it will be run.
- The automated tests must cover the same behaviors the human verification steps are checking, translated into repo-native test assertions and flows.
- Name the relevant test suite, file, or command whenever it can be discovered from context.
- Separate frontend and backend sections when both exist.
- If only one side applies, omit the other instead of filling it with placeholders.

## Completion Protocol

Every part must include a completion protocol that future implementers will follow after finishing the part:

1. Mark the part as done with the device date and time.
2. Re-check the `Verification` and `Expected results` sections against the actual implementation.
3. If anything changed, strike through the outdated text, add a short reason, and add the corrected text directly in the same section.
4. If the part has an SLA profile assigned in the plan, use the `sla-use-profile` skill to load that profile before continuing implementation or verification work.
5. Create or update the tests described for that part.
6. Run the relevant test commands and record the result in the plan.

Write this protocol into the plan, not just into the surrounding explanation.

## Test Planning Rules

Every part must include a `Tests to add or update` section.

Use these rules:

- Describe the concrete automated coverage that should be added or updated for the part.
- Make the planned automated coverage correspond directly to the manual verification steps for that part.
- Prefer repo-native tests such as unit, integration, API, e2e, or other existing test frameworks.
- When `Verification` lists a step-by-step user or system flow, the test plan should cover that same flow at the appropriate level of automation.
- The planned tests must match the specific part being implemented so they remain useful as later regression coverage.
- If the repo has no obvious existing test setup, record that the implementer must confirm the intended test workflow before implementation.
- If the user explicitly declines test creation, record that clearly in the plan.

Do not pretend a test suite exists when it cannot be verified.

## Writing Open Questions

Use `Open questions` only for unresolved facts that block accurate execution later. Keep them explicit and actionable.

Examples:

- missing base branch confirmation
- missing test workflow confirmation
- missing SLA profile assignments
- unresolved dependency or environment prerequisite

Do not create fake open questions to appear thorough.

## Writing Quality Bar

The plan should let another agent execute without guessing.

Before saving, check that:

- each part has a verifiable outcome
- each part includes `What to achieve`, `Technical details`, `Expected results`, `Verification`, `Completion protocol`, and `Tests to add or update`
- branch naming is recorded for each part
- base branch and base source are recorded, or explicitly listed as an open question
- SLA profile handling is recorded
- test handling is recorded
- the plan file path is inside the repo

## Final Response

After saving the plan:

- reply with the saved path
- summarize the feature in one or two sentences
- list any still-open blocking questions only if they remain unresolved
