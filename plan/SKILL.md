---
name: plan
description: Create repo-local implementation plans for features, refactors, migrations, and debugging work after mandatory adaptive requirement discovery. Use when the user asks for a plan, wants a feature broken into verifiable parts, or wants execution deferred until after planning.
---

# Plan

## Installation

### Plan directories

General plan directory:

Repository-specific plan directories:

Before using this skill, use the configured directory that applies to the repository. More than one directory may be configured: one general directory, repository-specific directories, or both.

If neither a configured directory nor a plan location in the current invocation is available, ask this exact question:

> Where should plan files be stored? You may provide one general directory, repository-specific directories, or both.

When the human answers this installation question, record the selected general and/or repository-specific directory in the blank fields above for future uses. If the human provides a location as part of a specific plan invocation, use it only for that plan; do not add it to this skill file.

## Overview

Create a planning artifact only. Do not implement code, modify product files, or run mutating project commands other than creating or updating the plan markdown file itself.

If a required fact is missing and cannot be discovered from the repo or the current conversation, do not guess. Say: `I don't know, help me get more context`.

## Mandatory Discovery Prerequisite

Before doing any plan-specific question collection, repository inspection, or writing `plan.md`, read and invoke the sibling [Plan Discovery skill](plan-discovery/SKILL.md). Invoke it on every use of this skill so it creates, resumes, validates, or refreshes the matching `discovery.plan.md`.

Plan Discovery owns product discovery, adaptive questions, local inspection, web research, evidence dates, and the `discovery.plan.md` artifact. It uses the same plan directory and plan slug as this skill. Do not duplicate its product questionnaire or repeat its research unless a plan-specific uncertainty remains.

Do not create or update `plan.md` until the matching discovery artifact has `Ready for plan: Yes`. If discovery reports a blocker, surface the exact question to the human and wait. Never turn a blocking unknown into a plan assumption.

## Plan-Specific Invocation Mode and Question Collection

After Plan Discovery is ready for planning, preserve the current session mode and try to switch to the session's dedicated plan mode, if one exists. Use that mode's native question feature to collect every required plan-specific question, including any missing installation question and other information needed to avoid guessing.

Write every question in clear, human-readable product language. Do not use acronyms; spell out the meaning in plain words instead.

After submitting the questions, restore the previous mode. If the native question interaction must remain active until answers arrive, restore the previous mode immediately after the answers return. If the previous mode was edit mode, return to edit mode. Do not leave the session in plan mode solely because this skill was invoked.

If the session cannot switch to plan mode or does not offer a native question feature, ask the required questions in a normal assistant response and wait for the human to send a new prompt with the answers. Do not inspect the repository, create a plan, or take other planning actions until that answer prompt arrives.

For the current turn after question collection:

- Plan only.
- Inspect the repo with read-only commands as needed.
- Do not edit app code, tests, configs, or docs outside the plan file.
- Do not create branches, worktrees, commits, or pull requests.
- Do not invent repo structure, test paths, branch names, or test workflows that are not in context.

## Required Questions

Ask these exact questions, in this order, on every invocation, even if related details appear in the repo or current conversation:

> Should this plan use regular branches or worktrees?

> Besides unit tests, where should this plan be tested?

Record the answers in the plan. The second answer establishes the implementation checkout convention. The third establishes the additional test environments, flows, systems, or QA process that the plan must cover; it does not replace unit-test planning.

If an answer is not supplied, do not assume it from the current branch or repository conventions. Wait for the human's answer before continuing.

## What To Discover First

Before writing the plan, use the ready `discovery.plan.md` as the source of product context and gather only additional plan-specific context needed to make the plan accurate:

1. Identify the repo root and current branch.
2. Use the configured plan directory, or the plan location supplied in the invocation.
3. Check which repo test suites already exist, such as unit, integration, e2e, Playwright, Cypress, or other documented automated test workflows.
4. Check whether the user already provided the feature goal, base branch, relevant test commands, suites, directories, and affected user flows.

Record the matching discovery artifact path in the plan and use its confirmed scope, acceptance criteria, risks, dependencies, and verification expectations. Do not treat a discovery-log entry as current truth when the canonical `Current specification` says otherwise.

Ask only for missing information that is required to avoid guessing. Keep questions short and concrete.

### Base branch

Ask which branch implementation branches or worktrees should branch from when it is not already clear. Record both when supplied:

- `Base branch`: the exact branch name
- `Base source`: where that branch should be pulled from, if the user specifies a remote or source branch

Do not default this from the current branch unless the user explicitly tells you to.

## Tests

Use the answer to the required testing question together with repo discovery to determine the test strategy. Record:

- exact test commands or suites when known
- additional test environment, QA flow, or system to use besides unit tests
- tests that need to be created as part of implementation
- test workflow that still needs confirmation

## Where To Save The Plan

Save the markdown file in the applicable configured plan directory, unless the current invocation specifies another location. Do not discover, infer, or create a fallback planning directory.

Give every plan its own directory and use this exact path shape:

`<plan-directory>/<plan-slug>/plan.md`

The slug should be short, stable, and feature-focused. Create the `<plan-slug>/` directory as part of saving the plan. Store the plan's creation date inside the plan, not in its filename.

## Plan Structure

Every plan must use this structure.

```md
# <Feature Name> Plan

## Goal

## Scope and assumptions

## Execution context
- Repo root:
- Plan file:
- Discovery specification:
- Created on: YYYY-MM-DD
- Current branch:
- Base branch:
- Base source:
- Checkout convention: Regular branches | Worktrees
- Additional testing location/process:
- Test strategy/status:

## Branch or worktree convention

## Parts

### Part 1: <Name>
Status: Pending
Completed at:
Implementation branch or worktree:

#### What to achieve

#### Acceptance criteria

#### Technical details

#### Expected results

#### Verification

##### Tests

#### Actual implementation and changes

#### Completion protocol

## Open questions
```

Set `Created on` to the plan's actual creation date using `YYYY-MM-DD` when the plan is saved.

## Branch or Worktree Convention

For each part, assign a planned implementation branch or worktree name using:

`<plan-slug>-part-<NN>`

Use a two-digit part number such as `01`, `02`, `03`. Only add the date suffix `-YYYYMMDD` if a collision is likely or the repo already uses dated branch names.

Record the exact planned name for every part and use it according to the checkout convention selected by the human.

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

### Acceptance criteria

Describe the product outcomes and all development needed for the part in product language. Write one or more criteria in this form:

`As a <subject>, I want <feature or outcome> so that <value>.`

These criteria must state what a user, operator, or system needs to achieve, not the implementation mechanism.

### Technical details

Write the implementation guidance with enough detail for an agent to execute accurately. Include:

- likely files and modules to inspect or edit
- interfaces, data flow, and control flow changes
- migrations, generators, RPC surfaces, schemas, or contracts if relevant
- automated tests that should be added or updated, including unit, integration, e2e, or other repo-native coverage that fits the part
- observability, logging, or operational details if they matter

Be precise. This section is primarily for implementers and agents.

### Expected results

Describe in natural language what should be true when the part is finished. This should read like a concrete outcome, not like code instructions.

### Verification

Write a step-by-step verification section separated into frontend and backend flows when both apply. It must include the human-visible checks and the test work for this part.

Format the flow as readable numbered steps with inline expected results, for example:

```md
• Frontend

1. Start the app in your normal dev setup.

2. Open the relevant page or flow.
   Expected result: the page loads with the new state visible.

• Backend

3. Run the focused test file for this part.
   Expected result: the new and existing tests pass.
```

Rules:

- Use natural language and make each step observable by a human or agent.
- Include the expected result directly after the step it validates.
- Name the relevant suite, file, command, environment, or QA process whenever it can be discovered from context.
- Separate frontend and backend sections when both exist. If only one applies, omit the other.
- Cover the additional testing location or process selected by the human, in addition to unit tests.

#### Tests

Within `Verification`, describe all test development for the part in product language. Use one or more criteria in this form:

`As a QA developer, I want to verify <behavior and conditions> so that <user or system outcome> remains reliable.`

For every criterion, specify the test level or process, the behavior to exercise, and the expected result. Include:

- new or updated coverage for the part's acceptance criteria
- the command, suite, environment, or QA flow that proves it when known
- regression coverage for affected pre-existing flows, including changes to old code

The tests must be descriptive enough for an implementer to know what to verify, and must correspond directly to the `Verification` flow.

### Actual implementation and changes

Complete this section during implementation. Describe what was actually implemented, how it relates to the planned technical details, and any deviations. Also record additional changes requested or identified during human code review, with their reason and impact.

Do not pre-fill this section with speculative implementation details.

### Completion protocol

Every part must include this completion protocol for future implementers:

1. Mark the part as done with the device date and time.
2. Re-check the `Acceptance criteria`, `Verification`, and `Expected results` sections against the actual implementation.
3. Complete `Actual implementation and changes`, including deviations and human code-review changes.
4. If anything changed, strike through the outdated text, add a short reason, and add the corrected text directly in the same section.
5. Create or update the tests described in `Verification > Tests`.
6. Run the relevant test commands and the additional testing process, then record the result in the plan.

Write this protocol into the plan, not just into the surrounding explanation.

## Writing Open Questions

Use `Open questions` only for unresolved facts that block accurate execution later. Keep them explicit and actionable.

Examples:

- missing base branch confirmation
- missing additional testing location or process
- missing test workflow confirmation
- unresolved dependency or environment prerequisite

Do not create fake open questions to appear thorough.

## Writing Quality Bar

The plan should let another agent execute without guessing.

Before saving, check that:

- each part has a verifiable outcome
- each part includes `What to achieve`, `Acceptance criteria`, `Technical details`, `Expected results`, `Verification`, `Verification > Tests`, `Actual implementation and changes`, and `Completion protocol`
- the acceptance criteria and test criteria use the required product-language forms
- the planned branch or worktree name is recorded for each part
- the checkout convention, base branch, and base source are recorded, or explicitly listed as open questions
- unit-test and additional-test handling are recorded
- the plan file uses its own `<plan-slug>/` directory and is named `plan.md`
- the execution context records the plan's creation date

## Final Response

After saving the plan:

- reply with the saved path
- summarize the feature in one or two sentences
- list any still-open blocking questions only if they remain unresolved
