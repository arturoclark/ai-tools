---
name: plan-discovery
description: Research and clarify a proposed feature in an evolving discovery file, with behavioral acceptance criteria, candidate implementation approaches, optional requested prototypes, and readiness for planning. Use to discover what to build before implementation or to update an existing discovery.
---

# Plan Discovery

Turn the human's idea, however vague or concrete, into an accurate, evidence-grounded description of what they want to build and what building it requires. Discovery creates and updates its artifact; it does not implement product changes except for prototypes explicitly requested by the human. Do not create an implementation plan automatically.

## Resolve the discovery file first

The invocation may supply an existing discovery file, a storage directory, a feature description, or a prototype request.

- If an existing discovery file is supplied, read and update that exact file. Do not create a new directory, rename it, or relocate it. Preserve useful content and history while bringing its current specification into this skill's structure. If the path is missing or ambiguous, ask for the correct file rather than creating a replacement.
- For a new discovery, use a storage location explicitly supplied for this discovery in the invocation or conversation. Otherwise ask: **Where should this discovery be stored?** Wait for the answer before creating files. Do not invent a fallback or persist the answer into this skill.
- Once the location is known, create `<location>/<yy-mm-dd>-<feature-slug>/discovery.md` before subject research. Use the actual local creation date and a short feature-focused slug grounded in the human's request. If no meaningful feature name is available, ask for one. Check for collisions; do not overwrite or silently adopt an unrelated discovery. Ask which file to resume or which distinct slug to use when ownership is unclear.
- Start from [the discovery template](assets/discovery-template.md), filling known context and marking unknowns honestly. Keep the original path and creation date stable on subsequent updates; update the last-updated date.

## Understand and research

Begin with supplied context. Describe the intended actor, problem, goal, experience, and scope as far as the evidence supports. Do not force a questionnaire or require a detailed specification before investigating.

Identify uncertainties that could change the behavior, feasibility, scope, dependencies, or implementation approach. Research those uncertainties using relevant sources: the local repository, other relevant files on the computer, connected sources, authoritative online documentation, or other available evidence. Follow references as needed; do not restrict discovery to the current repository. Search relevant locations and sources rather than collecting unrelated material.

For each material finding, record its source path or link, the date observed or researched (`YYYY-MM-DD`), what it establishes, its implications, and any limits. Distinguish existing behavior from proposed behavior. Observation dates are not necessarily the dates source events occurred. Record source versions when they materially affect the conclusion. Report inaccessible sources and conflicting evidence explicitly.

Separate human requirements, observed facts, candidate approaches, and unresolved questions. Research can establish facts; it cannot silently approve product decisions. Offer evidence-grounded proposals as proposals, never as confirmed requirements. If a necessary fact cannot be established, say: `I don't know, help me get more context` and identify the exact missing context.

Ask focused human questions only when their answers materially affect the discovery and cannot be established from available sources. Use clear product language without acronyms in human questions. Wait for answers before dependent work; continue independent research where useful. Do not repeat questions already answered. Persist findings as discovery progresses, not just at the end.

## Proposed behavioral acceptance criteria

Use the exact section title **Proposed behavioral acceptance criteria**. These are observable, testable conditions the feature must satisfy, specifying outcomes without prescribing implementation. The section title communicates their provisional status; write each condition as a concrete outcome, without weakening it into vague aspirations.

Use stable identifiers and this format:

```markdown
### AC-01 — Preserve input after save failure

If saving fails, entered information remains available for retry.

#### Proposed implementation approach

- **Failure and recovery flow:** Retain the entered values and offer retry.

Supporting evidence and unresolved decisions: ...

#### Discovery gaps and caveats

No known discovery gaps.
```

Keep each criterion focused on an independently observable outcome. Cover successful, blocked, failure, and recovery behavior when relevant and supported. Do not invent rules, limits, screens, or approved designs to make a criterion look complete. State unresolved behavior in open questions and identify affected criteria.

Under **every** criterion, include **Proposed implementation approach**. Select as many useful categories as needed; the following list is illustrative, not exclusive:

| Approach category | What it describes |
| --- | --- |
| Interaction flow | Controls, inputs, feedback, and immediate responses. |
| User flow | The user's sequence from entry point to completed goal. |
| Technical approach | Candidate operations, components, interfaces, and processing. |
| Data model | Candidate records, relationships, ownership, and lifecycle. |
| Authorization approach | Who may act and how access would be constrained. |
| Integration approach | Exchanges with other systems and their dependencies. |
| Failure and recovery flow | Failed outcomes, retained state, and retry or correction. |
| Verification approach | How observable outcomes could be demonstrated. |

These describe candidate ways to achieve the criterion, pending discovery decisions. Use concrete repository details only when verified. Where an approach is not yet known, record the uncertainty and the next investigation instead of fabricating an approach. Keep internal implementation choices outside the behavioral condition.

After **Proposed implementation approach**, include **Discovery gaps and caveats** under every criterion. Record the current unknowns requiring research or a human decision; blockers preventing their resolution and what would unblock them; known limitations, dependencies, or tradeoffs; and whether these gaps block planning and why. Reference shared questions in **Open questions** rather than duplicating them. If none remain, state **No known discovery gaps.** Do not imply absolute certainty.

Keep this subsection current: once an item is resolved or no longer applies, remove it from the criterion's active gaps and record it in **Human inputs, decisions, and evidence history**, just as for a removed criterion. Preserve its former description, affected criterion identifier, resolution or removal reason, supporting evidence or human decision, and date (`YYYY-MM-DD`). Update the criterion and proposed approach with any resulting understanding, remove resolved shared open questions into history, and reassess planning readiness. Keep unresolved items and still-applicable caveats visible; do not remove them merely because they do not block planning.

Preserve identifiers when revising criteria. Allocate new numbers for new outcomes; do not renumber existing criteria or reuse retired numbers. Remove obsolete criteria from the current list but record their identifier, former behavior, removal reason, and date in history. Record material revisions and their source there as well.

## Optional prototype

Create or modify a prototype only when the human requests it. Before editing product files, establish enough understanding of the intended actor, goal, main flow, observable outcomes, and prototype scope to match the request. Resolve unknowns that would materially change the prototype. Record this understanding and the prototype's purpose, boundaries, and related criteria first.

Inspect repository state and establish the prototype base branch from explicit context; ask if it is unknown. Create `prototype/<slug>` from that base and verify the active branch before editing product files. Record the branch, base branch, and checkout path. Resume an existing branch only when it is established as this discovery's prototype. Do not overwrite branches, discard changes, or carry unrelated changes into the prototype; resolve unclear ownership or conflicting checkout state with the human.

Keep changes within the requested prototype. Document its flows, screens, interactions, user experience, error states, simulated behavior, and limitations. Use relevant checks to verify the demonstrated flows; record observed results and checks not run. Do not present a prototype as production-ready or deploy or publish it without authorization.

Iterate from human feedback on the same prototype unless a different direction is requested. Update the current understanding, candidate approaches, and proposed behavioral acceptance criteria when the desired behavior changes; add, revise, or retire criteria as needed. Record each material iteration with its date, feedback, changes, verification, and affected criterion identifiers. Distinguish human-directed changes from agent experiments; experiments alone do not establish confirmed requirements.

## Maintain the discovery and planning readiness

Use the template's structure while keeping entries proportional to the feature. Retain the general **Ready for plan** section and the dated **Human inputs, decisions, and evidence history** section on every discovery. Keep the prototype section with `Not requested` until applicable; expand it when requested.

Record every human input relevant to this discovery with its received date and attribution, preserving its meaning and concrete requirements. Record decisions and material evidence with `YYYY-MM-DD`, source, reason or implication, and affected criteria when relevant. Keep earlier entries; mark superseded decisions and link their replacements rather than rewriting history. Do not duplicate sensitive values into the artifact; record a safe reference instead.

Reassess **Ready for plan: Yes | No** after material updates:

- **Yes** when the intended outcome, scope, proposed behavioral criteria, material constraints and dependencies, and plausible approaches are sufficiently understood to produce an accurate plan. Relevant verification must be identifiable, and no unresolved question may block planning. Record non-blocking uncertainties explicitly. A prototype is not required.
- **No** when material planning inputs remain unresolved. Name each blocker, why it matters, and what evidence or human answer would resolve it. Do not convert blockers into invented assumptions.

Readiness means sufficient understanding to plan, not approval to implement and not that all proposals are confirmed. Provide a planning handoff referencing the current criteria, dependencies, research, prototype, and remaining uncertainty. If planning is requested separately, preserve the behavioral outcomes and identifiers when adding planning detail; do not silently promote candidate implementation choices into requirements.

At handoff, report the discovery file path, a concise statement of current understanding, readiness, and any blocking questions. State prototype branch and verification limitations when a prototype was involved.
