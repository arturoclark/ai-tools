# Specification and issue model

Use this model to draft a specification before selecting tracker fields. Omit sections that do not apply; do not fill gaps with invented content.

## Specification

```md
# <Outcome name>

## Problem and outcome

## Stakeholders and users

## Scope

## Non-goals

## Confirmed decisions

## Open questions and assumptions requiring confirmation

## Risks, dependencies, and constraints

## Research findings and alternatives

## Proposed delivery slices and dependency order
```

## Product story

```md
Title: <verb-led user outcome>

## Product outcome
As a <user or stakeholder>, I want <capability> so that <value>.

## Scope and non-goals

## Acceptance criteria
- Given <context>, when <action>, then <observable result>.

## Happy paths
1. <action>
   Expected result: <observable result>.

## Unhappy and edge paths
1. <invalid, unavailable, unauthorized, boundary, or recovery condition>
   Expected result: <safe observable result>.

## Dependencies and risks

## Technical notes
Only confirmed implementation constraints or links to independently tracked technical tasks.

## Test expectations
<Automated and/or manual coverage, once the human confirms its location.>
```

## Technical task

Create only when it has a distinct deliverable or a real dependency relationship.

```md
Title: <implementation outcome>

## Delivery purpose
<Which approved product outcome this enables.>

## Confirmed technical approach

## Impacted interfaces, systems, or data

## Implementation acceptance criteria

## Failure and recovery considerations

## Automated coverage

## Dependencies
```

## QA task

```md
Title: Verify <product outcome>

## Linked delivery item

## Test location and ownership

## Scenarios to verify
- Happy path: <expected result>
- Unhappy or edge path: <expected result>

## Automation approach

## Entry and exit criteria
```

## Bug

Describe observed behavior, expected behavior, reproduction steps, impact, affected version/environment, and a regression test expectation. Do not turn a suspected defect into a bug without confirmation that the observation is real.
