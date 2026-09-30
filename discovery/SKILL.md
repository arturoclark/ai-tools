---
name: discovery
description: Explore an idea, requirement, system, or question to clarify what is known, what remains uncertain, and what evidence supports it. Use for standalone understanding or to prepare an optional input to the plan skill.
---

# Discovery

## Purpose

Help the human understand a topic or turn an uncertain idea into a clear, evidence-grounded specification. Discovery can end with an answer, a summary of findings, a decision record, or a planning handoff. Do not assume that every discovery needs an implementation plan or a file.

Discovery itself does not implement product changes. Inspect relevant context, ask questions that could materially change the outcome, and research externally when it would resolve an important uncertainty. Distinguish human statements, observed facts, and agent inferences. When a necessary fact cannot be established, say: `I don't know, help me get more context` and state the exact context needed.

## Approach

Begin with the information already supplied. Identify the most important uncertainty, then use the smallest useful combination of questions, local inspection, and targeted research to resolve it. Do not repeat answered questions or force a fixed questionnaire. Continue in passes only while another pass could materially improve the requested understanding or decision.

Use clear product language for human questions. Record material evidence with its source and the date it was observed or researched (`YYYY-MM-DD`). Date human input as received and label it as human input; do not present the observation date as the date an older source fact occurred. Summarize source material rather than copying it.

Report the current understanding, relevant evidence, decisions or assumptions, remaining unknowns, and the next useful step. The depth and format should fit the request. A simple question may need only a concise answer; a complex requirement may need an evolving specification.

## Optional Artifact

Create or update a discovery artifact when the human requests one, when the work needs a durable record, or when it will feed a plan. Use a location supplied in the current request. For a planning handoff, use the applicable directory from the sibling [Plan skill](../plan/SKILL.md), if configured, and save the matching file at:

`<plan-directory>/<plan-slug>/discovery.plan.md`

If a planning artifact is needed but no location is available, ask the Plan skill's installation question. Do not invent a fallback directory. If a matching file exists, update it rather than creating a duplicate.

Keep an artifact's current findings easy to locate. Include the goal or question, confirmed scope or findings, evidence and dates, decisions and assumptions, open questions, and a short discovery log when the history helps. Add acceptance criteria, constraints, dependencies, risks, and verification expectations when the subject is a product requirement. Omit sections that do not apply.

## Optional Planning Handoff

When the human wants to use discovery as the basis for an implementation plan, include a `Current specification` section with the confirmed goal, scope, functional behavior and acceptance criteria, constraints, dependencies, risks, verification expectations, and open decisions. Add a `Planning handoff` section that states whether the known information is sufficient to plan, what outcomes can be verified independently, and which exact questions still block an accurate plan.

Use `Ready for plan: Yes` only when the material planning inputs are sufficiently clear. Document non-blocking assumptions explicitly. If a required answer is missing, use `Ready for plan: No`, state the missing context, and do not invent an answer or produce a plan. The [Plan skill](../plan/SKILL.md) may use this file as an optional input; invoking discovery is not required before planning.
