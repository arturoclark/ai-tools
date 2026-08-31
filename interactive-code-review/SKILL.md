---
name: interactive-code-review
description: "Explain current Git changes against supplied requirements in implementation order, with clickable source references. Use for an interactive manager-facing code-change walkthrough, not for making code changes."
---

# Interactive Code Review

Turn the current working tree's changes into a clear, requirement-aware walkthrough for a manager. The user supplies the requirement text that explains what the change is meant to achieve. This is an explanatory review: inspect and report; do not modify code, create commits, or broaden the diff unless the user explicitly asks.

## Establish the review scope

- Treat staged changes, unstaged changes, and relevant untracked files as the current Git changes. Inspect their actual contents, not just `git status` or a diff stat.
- Read enough unchanged surrounding code to explain each change's role and its relationship to the supplied requirements. Do not infer intent that is unsupported by either the requirement text or the code. If a necessary requirement, baseline, or dependency cannot be determined, say: `I don't know, help me get more context.`
- Organize the walkthrough in implementation order: begin with foundational types, data, configuration, or shared helpers; then the domain/backend flow; then callers, UI, tests, and generated artifacts. Use a different order when the code's actual execution flow makes that clearer. Do not force a file-by-file alphabetical listing.

## Write the walkthrough

Open with a brief statement of the intended outcome and the reviewed change scope. Then present the walkthrough as a single numbered Markdown list (`1.`, `2.`, and so on), in the chosen implementation order.

Each numbered item explains exactly one user-visible feature, behavior change, or tightly coupled group of changes. Do not combine independent features into one item merely because they touch related files. A group is appropriate only when its parts together deliver one behavior and separating them would make the explanation less clear.

Write every item for a product manager: name the affected resources, screens, roles, or workflows; explain the practical before-and-after behavior; state why it matters to the requirement; and describe any important constraint, follow-on effect, trade-off, or risk in plain language. Translate implementation details into their product effect. For example, do not only say that resources replaced `user_id` with `billing_account_id`; identify the resources and explain that ownership now follows the billing account, who can change it, and what that means in the UI or workflow when the code supports those facts.

Group tightly related files within the same numbered item when they support that single behavior, while retaining clear file-level references. Mention generated or lock files succinctly and explain what generated them when the evidence supports it. Call out a meaningful gap between the requirement and the diff plainly; do not present it as completed work.

Use concise Markdown headings only when they improve navigation; the substantive explanations must remain numbered list items. Avoid pasting large code blocks, narrating trivial formatting changes, or inventing review findings. Technical terms are welcome when they clarify the change, but define their practical effect in plain language.

## Source references

Every substantive claim must include a clickable local source reference immediately after the clause or sentence it supports. Do not collect several references at the end of a long explanation: when an item makes multiple distinct claims, put each reference beside its corresponding claim so the reader can tell what it proves. Use the exact current line numbers and paths. Format it like this:

`[../relative/path.ext:12-20](/absolute/path/to/relative/path.ext:12)`

The label gives the relevant line span; the link target uses the absolute local path and its first line so the application can open the file. For a whole small file or a non-line-based artifact, link to its first relevant line or file path.

## Continue interactively

When the user gives follow-up feedback, apply it to the existing walkthrough: inspect any newly relevant diff or surrounding code, correct the affected explanation, and provide the revised section or concise delta. Preserve earlier conclusions that remain supported. If the user asks to change the implementation, treat that as a separate coding request and obtain the context needed before acting.
