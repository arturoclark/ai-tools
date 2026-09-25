---
name: plan-discovery
description: Discover a vague idea, desired outcome, or detailed requirement into a dated, research-grounded product specification before implementation planning. Use as the mandatory discovery prerequisite for the plan skill.
---

# Plan Discovery

## Purpose

Turn the human's current idea, outcome, or requirement into a compact, evidence-grounded specification that is ready to drive an implementation plan. The work is discovery, not implementation: do not modify product code, tests, configuration, or documentation outside the discovery artifact.

There is no fixed number of stages. Use adaptive discovery passes: each pass resolves the most important remaining uncertainty and makes the canonical specification clearer. Stop when no unanswered question would materially change the product outcome, scope, acceptance criteria, technical approach, verification, risk, or dependency.

## Location and Artifact

Use the plan directory configuration and current-invocation location rules in the sibling [Plan skill](../SKILL.md). Use the same applicable plan directory and the same feature-focused slug as the related implementation plan.

Save all discovery content in exactly one file:

`<plan-directory>/<plan-slug>/discovery.plan.md`

Do not create a fallback directory. If neither an applicable configured directory nor a location in the current invocation is available, ask the exact installation question required by the Plan skill. If a matching discovery file exists, resume it and add only work needed to validate or refresh the specification; do not start a duplicate file.

## Invocation Mode and Question Collection

At the start of every invocation, preserve the current session mode and try to switch to the session's dedicated plan mode, if one exists. Use that mode's native question feature to collect the questions needed to avoid guessing.

Write every question in clear, human-readable product language. Do not use acronyms; spell out the meaning in plain words instead.

After submitting the questions, restore the previous mode. If the native question interaction must remain active until answers arrive, restore the previous mode immediately after the answers return. If the previous mode was edit mode, return to edit mode. Do not leave the session in plan mode solely because this skill was invoked.

If the session cannot switch to plan mode or does not offer a native question feature, ask the required questions in a normal assistant response and wait for the human to send a new prompt with the answers. Do not inspect the repository, research the web, create a discovery file, or take other discovery actions until that answer prompt arrives.

## Adaptive Discovery

Begin from the information already supplied. State a short current understanding, then ask only questions whose answers could materially change the specification. Do not repeat answered questions or force a preset questionnaire on a detailed requirement.

Choose the next pass from the uncertainty, not from a fixed checklist. Depending on the requirement, a pass may explore the problem and desired outcome, people and value, scope and exclusions, acceptance criteria, behavior and edge cases, existing system constraints, data and integrations, security or operational concerns, accessibility, verification, or another material topic.

Use product language for human questions. Batch closely related questions when doing so gives the human enough context to answer accurately without creating an unfocused questionnaire. For every answer, distinguish what the human stated from an agent inference.

Each pass must:

1. State the uncertainty or decision it is resolving.
2. Record the questions asked and the answers received.
3. Inspect relevant local files or repositories when they can validate or constrain the specification.
4. Conduct targeted web research for applicable patterns, designs, architectures, standards, comparable use cases, or acceptance-criteria expectations.
5. Record material evidence with its source and discovery or research date.
6. Update the canonical specification instead of duplicating it.
7. State the next uncertainty, or why the specification is ready for planning.

Research only what is relevant to the requirement. Prefer primary or authoritative sources for technical standards and official product behavior. Summarize findings; do not copy source material into the file. When a fact cannot be verified from the human, local context, or research, write: `I don't know, help me get more context`.

## Evidence and Dates

Record every material fact discovered during local inspection or external research with the date it was discovered or researched, using the device date in `YYYY-MM-DD` format. Include the precise local path or web URL and explain its planning impact. Date human-provided information as received, and label it as human input rather than independently verified fact.

Do not assign a discovery date to pre-existing source content as though it were the date it occurred. The date records when the agent observed or researched it.

## Discovery File Structure

Use this structure. Keep `Current specification` concise and authoritative; it is the only section the Plan skill should need to read first. Do not reproduce it in every pass.

```md
# <Feature Name> Specification

## Current specification

### Problem and desired outcome

### Users and value

### In scope

### Out of scope

### Functional behavior and acceptance criteria

### Constraints, dependencies, and non-functional expectations

### Verification expectations

### Open decisions and blockers

## Discovery status
- Specification maturity: Exploring | Validating | Ready for plan
- Created on: YYYY-MM-DD
- Last updated: YYYY-MM-DD
- Next uncertainty to resolve:
- Planning blocked by:

## Decisions and assumptions

### <Decision or assumption>
- Status: Decided | Assumption requiring confirmation
- Decision or assumption:
- Reason:
- Source:
- Discovered or decided on: YYYY-MM-DD
- Specification and planning impact:

## Evidence and research

### <Finding>
- Finding:
- Source: Human input | local path | web URL
- Discovered or researched on: YYYY-MM-DD
- Confidence or limitation:
- Specification and planning impact:

## Discovery log

### Discovery pass: <topic>
- Date: YYYY-MM-DD
- Why this pass was needed:

#### Questions and answers
1. Question: <exact product-language question>
   Answer: <human answer, or `Not yet answered`>

#### Local discovery and web research
- <only the material work and findings for this pass>

#### What changed in the current specification
- <concise delta, or `No change`>

#### Remaining uncertainty
- <next question or `None`>

## Planning handoff
- Ready for plan: Yes | No
- Confirmed planning inputs:
- Recommended independently verifiable outcomes:
- Risks and dependencies the plan must address:
- Open questions that block a plan:
```

Omit empty subheadings only when they do not apply. Keep question-and-answer entries concise, but preserve the question and the human's answer. Record only discovery passes that materially validate, change, or narrow the specification.

## Ready-for-Plan Gate

Set `Ready for plan: Yes` only when the goal, scope, acceptance criteria, material constraints, dependencies, risks, and verification expectations are sufficiently clear to produce an accurate plan. The specification can contain documented non-blocking assumptions, but it cannot conceal unanswered material questions.

When discovery is blocked, set `Ready for plan: No`, state the exact missing context in `Planning handoff`, and wait for the human. Do not produce an implementation plan or invent an answer.
