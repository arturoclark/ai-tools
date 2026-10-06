---
name: discovery
description: Explore an idea, requirement, system, or question in a discovery file to clarify what is known, what remains uncertain, and what evidence supports it.
---

# Discovery

## Installation

General discovery directory:

Repository-specific discovery directories:

Before starting discovery, use the configured directory that applies to the repository or a location supplied in the current request. If neither is available, ask this exact question and wait for the answer:

> Where should discovery files be stored? You may provide one general directory, repository-specific directories, or both.

When the human answers this installation question, record the selected general and/or repository-specific directory in the blank fields above for future uses. If the human provides a location for only the current discovery, use it for that discovery without adding it to this skill file. Do not invent a fallback directory.

## First action

Once the location is known, create the discovery file before inspecting the repository, researching, or asking questions about the subject. Use a short, stable slug based on the human's request and save it at:

`<discovery-directory>/<discovery-slug>/discovery.md`

Create the slug directory as part of saving the file. Start the file with the question or goal, its creation date (`YYYY-MM-DD`), and any context already supplied by the human. If the matching file already exists, open and update it before doing further discovery; do not create a duplicate. Continue recording findings and decisions in that file as discovery proceeds.

## Purpose

Help the human understand a topic or turn an uncertain idea into a clear, evidence-grounded specification. Discovery can end with an answer, a summary of findings, a decision record, or a planning handoff. Every discovery has a file.

Discovery itself does not implement product changes. Inspect relevant context, ask questions that could materially change the outcome, and research externally when it would resolve an important uncertainty. Distinguish human statements, observed facts, and agent inferences. When a necessary fact cannot be established, say: `I don't know, help me get more context` and state the exact context needed.

## Approach

Begin with the information already supplied. Identify the most important uncertainty, then use the smallest useful combination of questions, local inspection, and targeted research to resolve it. Do not repeat answered questions or force a fixed questionnaire. Continue in passes only while another pass could materially improve the requested understanding or decision.

Use clear product language for human questions. Record material evidence with its source and the date it was observed or researched (`YYYY-MM-DD`). Date human input as received and label it as human input; do not present the observation date as the date an older source fact occurred. Summarize source material rather than copying it.

Ask questions for the human in a normal assistant response and wait for a new prompt with the answers before continuing work that depends on them.

Report the current understanding, relevant evidence, decisions or assumptions, remaining unknowns, and the next useful step. The depth and format should fit the request. A simple question may need only a concise answer; a complex requirement may need an evolving specification.

## Discovery File

Keep an artifact's current findings easy to locate. Include the goal or question, confirmed scope or findings, evidence and dates, decisions and assumptions, open questions, and a short discovery log when the history helps. Add acceptance criteria, constraints, dependencies, risks, and verification expectations when the subject is a product requirement. Omit sections that do not apply.

## Optional Planning Handoff

When the human wants to use discovery as the basis for an implementation plan, include a `Current specification` section with the confirmed goal, scope, functional behavior and acceptance criteria, constraints, dependencies, risks, verification expectations, and open decisions. Add a `Planning handoff` section that states whether the known information is sufficient to plan, what outcomes can be verified independently, and which exact questions still block an accurate plan.

Use `Ready for plan: Yes` only when the material planning inputs are sufficiently clear. Document non-blocking assumptions explicitly. If a required answer is missing, use `Ready for plan: No`, state the missing context, and do not invent an answer or produce a plan.
