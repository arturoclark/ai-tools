---
name: plan
description: Create repo-local implementation plans for features, refactors, migrations, and debugging work. Use when the user asks for a plan, wants a feature broken into verifiable parts, or wants execution deferred until after planning.
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

## Optional Discovery Input

The invocation may include a discovery file as an input. When one is supplied, use its confirmed scope, acceptance criteria, risks, dependencies, and verification expectations as the basis for the plan. Record the discovery file path in the plan's scope and assumptions.

The [Discovery skill](../discovery/SKILL.md) can prepare this input, but it is optional. Do not invoke it automatically. If the supplied discovery file has an unresolved required fact, surface the exact question to the human and wait. Never turn a blocking unknown into a plan assumption.

## Question Collection

If the invocation supplies a plan file, read that file first to determine whether it answers the required checkout and testing questions. This is the only planning action allowed before question collection is complete. Ask every question whose answer is still missing or ambiguous, including any missing installation question and other information needed to avoid guessing, in a normal assistant response. Wait for the human to send a new prompt with the answers before continuing work that depends on them.

Write every question in clear, human-readable product language. Do not use acronyms; spell out the meaning in plain words instead.

Do not inspect the repository, create a plan, or take other planning actions until the answer prompt arrives, except for reading a plan file supplied with the invocation as described above. If the supplied file resolves every required question, continue without an answer prompt.

For the current turn after question collection:

- Plan only.
- Inspect the repo with read-only commands as needed.
- Do not edit app code, tests, configs, or docs outside the plan file.
- Do not create branches, worktrees, commits, or pull requests.
- Do not invent repo structure, test paths, branch names, or test workflows that are not in context.

## Required Questions

Ask these exact questions, in this order, on every invocation that does not supply a plan file:

> Should this plan use regular branches or worktrees?

> Besides unit tests, where should this plan be tested?

When a plan file is supplied, infer each answer from the file if its checkout convention or additional testing location or process is clear. Ask only the question or questions that the file cannot answer, using the exact wording and order above. Do not fill gaps from repository conventions or guesses.

Record the answers, whether inferred from the supplied plan file or provided by the human, in the plan. The first establishes the implementation checkout convention. The second establishes the additional test environments, flows, systems, or QA process that the plan must cover; it does not replace unit-test planning.

If an answer cannot be inferred from a supplied plan file and is not provided by the human, do not assume it from the current branch or repository conventions. Wait for the human's answer before continuing.

## What To Discover First

Before writing the plan, gather only the context needed to make the plan accurate:

1. Identify the repo root and current branch.
2. Use the configured plan directory, or the plan location supplied in the invocation.
3. Check which repo test suites already exist, such as unit, integration, e2e, Playwright, Cypress, or other documented automated test workflows.
4. Check whether the user already provided the feature goal, base branch, relevant test commands, suites, directories, and affected user flows.

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

Write user-journey-based acceptance criteria in product language: where the user starts, what they do, under which conditions, what they observe, and why it matters. Use this adaptable form:

`As a <role>, in <actual product area>, after <navigation or context>, when I <action> with <conditions>, I want <observable result> so that <purpose>.`

Include the actual entry point and trigger needed to locate and exercise the behavior. Preserve known screen, navigation, and control labels in their original language. Discover missing workflow facts from available context or the repo; if required facts remain unknown, say `I don't know, help me get more context` and ask for them. Never invent screens, controls, navigation, or business rules.

For non-UI work, use the known caller or process, entry point, and triggering event instead of screens and clicks. Adapt the sentence to read naturally; omit clauses that do not apply. Keep each criterion concise and complete, sharing common journey context above related criteria when that avoids repeating a long walkthrough.

State observable product behavior, including the interactions needed to deliver it. Cover successful and blocked outcomes where applicable, including what the user or caller observes and what they need to correct. Include concrete accepted/rejected cases, boundaries, or numeric examples when they clarify the behavior and are supported by confirmed requirements. Keep internal schema names, code paths, implementation mechanisms, and test commands in `Technical details` or `Verification`; externally observable API contract details belong in acceptance criteria when needed to specify the interaction.

Keep each user-journey-based criterion as a bullet. Only when it needs interaction design–level acceptance criteria, derive a numbered list directly beneath that criterion, indented under its bullet. These details specify how the actor or caller reaches and uses the outcome; they supplement the journey sentence rather than replace it. Do not add them to every criterion or repeat behavior already clear in the sentence.

Use only the details needed to make that interaction actionable and verifiable. Depending on the criterion, these may include actor/caller, entry point, inputs, control and label, request or action, navigation or response, observable result, next action, and purpose. This is not a fixed checklist or order. Apply it to UI, API, and other non-UI interactions alike: for an API, the needed details might be the operation, request inputs, returned status/data, and how the caller uses the response next.

Ground existing interactions in the supplied context or repository. Identify requested new controls, navigation, or API interactions explicitly as additions. Do not silently turn an illustrative example into an approved design. If a required interaction decision is unresolved, say `I don't know, help me get more context` and ask for that decision.

Example format, assuming the human has confirmed the proposed history entry point and label:

```md
- As a reconciliation operator, when saving a correction and reopening the user's report, I want the corrected amounts retained and the earlier report version preserved so that I can review both what was previously reported and what changed.
  1. Add “View old reports” to each record's details menu so the operator can access earlier saved reports for that record.
  2. Selecting “View old reports” shows the saved versions; opening one displays that version's saved amounts for review.
```

This illustrates placement and detail, not a required history feature or a requirement for a visual comparison. Criteria whose interactions are already clear remain standalone journey bullets.

Example using a confirmed workflow:

- Before: “As a reconciliation operator, I want all-zero and all-positive uploaded dimension sets accepted so that valid carrier files can be processed.”
- After: “As a reconciliation operator, in ‘Conciliación de guías’, after opening a record from ‘Historial de cargas’ and grouping guides by user, when I click ‘Generar reporte’ for that user, I want guides with uploaded dimensions of 0×0×0 or all greater than zero (for example, 10×12×20) included in the priced report, provided the other required pricing information is available, so that I can review and share it.”

Use the example's structure, not its domain rules, for other plans.

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

Describe product-facing verification flows in the same user-journey-based style as acceptance criteria: actual entry point, navigation/context, action, conditions, observable result, and purpose. Shared context can introduce the numbered steps; preserve actual product labels and include concrete cases when useful. Apply this to manual checks and automated product flows alike. Exercise the interaction details attached to each applicable criterion, including API caller interactions when relevant.

Technical checks, such as unit tests, running commands, builds, or schema checks, use direct technical instructions with the relevant command or check and expected result. They do not require a user journey or an “As a…” sentence.

Format the flow as readable numbered steps with inline expected results, for example:

```md
• Frontend

1. Start the app in your normal dev setup.

2. Follow the confirmed navigation to the named product area, perform the feature's action with the specified input, and check the result.
   Expected result: the observable outcome described in the acceptance criterion appears, enabling the user's stated purpose.

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

Within `Verification`, describe product-facing test scenarios in the same user-journey-based style as acceptance criteria, including the user's actual entry point, action, conditions, observable outcome, and purpose. Use this adaptable form when writing a test criterion:

`As a QA developer, I want to verify that <role>, starting at <actual entry point or context>, can <action under conditions> and observe <result> so that <user or system purpose> remains reliable.`

Describe technical tests, including unit tests and command execution, directly: specify the unit or check, inputs or conditions, command or suite when known, and expected result. Do not force these into a user journey or the QA sentence form. When a product scenario also needs a command to run it, keep the scenario in journey language and list the command separately.

For every test, specify the test level or process, the behavior to exercise, and the expected result. Include:

- new or updated coverage for the part's acceptance criteria
- coverage of any interaction details beneath those criteria, using the same entry points, actions/inputs, observable results, and next actions
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
- the acceptance criteria describe a known entry point, navigation/context, trigger, conditions, observable result, and purpose, using shared context where helpful; non-UI criteria use a known caller/process and trigger
- only criteria needing interaction design detail have a numbered list directly beneath their journey bullet; those details make the relevant UI, API, or other interaction actionable and verifiable without prescribing internal implementation
- actual product labels and their language are preserved, with no invented workflow or business decisions
- successful and blocked outcomes are covered where applicable, with concrete cases or numeric examples when useful and confirmed
- acceptance criteria, product-facing verifications, and product-facing test scenarios use the same user-journey-based product language; technical checks and unit tests use direct technical instructions, with commands separate from product scenarios
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
