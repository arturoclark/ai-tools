---
name: plan-implement
description: Implement the next unfinished part of an existing /plan plan, starting on its planned branch or worktree. Use when given a plan name, plan directory, or plan.md path for execution; do not use to create a new plan.
---

# Plan Implement

Implement one part per invocation. The input is a plan name, its directory, or its `plan.md` path, and may include additional parameters or instructions from the human. Plans produced by the Plan skill use `<plan-directory>/<plan-slug>/plan.md` and record the checkout convention, base branch, planned part names, outcomes, tests, and completion protocol. Read the selected plan in full before changing the repository. Do not invoke the planning or discovery workflows again unless the human requests them.

## Find the next part

Resolve a supplied file or directory directly. For a name, look in the plan locations configured in the Plan skill and any location already supplied in the conversation; consider a clearly matching plan in the current repository. If none or several match, ask for the exact path. Do not create a plan or guess which one the human meant.

Select the first part in plan order that is not marked done. A part with existing code or an in-progress status is still unfinished: inspect and resume it rather than starting the next part. If every part is done, report that fact. Check the selected part's open questions, acceptance criteria, technical details, expected results, verification, and earlier dependencies. If a required fact is absent and cannot be found in the plan or repository, say `I don't know, help me get more context` and ask for that fact.

Before starting implementation, send the human a commentary response with the selected part's complete `Acceptance criteria` list, preserving each criterion's wording and order. Do this after selecting and reading the part and before editing product files or tests. If the part cannot proceed, still show the criteria when available and explain the blocker.

## Apply invocation instructions

Read all additional parameters and instructions alongside the selected part. Follow instructions meant for before implementation after establishing the checkout, instructions meant for during implementation as the work proceeds, and instructions meant for after implementation before the final handoff. Incorporate later human directions in the same way. Explicit human instructions take precedence over conflicting plan details; record material changes or deviations in the plan so it remains accurate. If the timing or scope of an instruction is unclear and affects the outcome, ask for clarification rather than silently omitting it or guessing. Do not treat an instruction for this invocation as a permanent change to future parts unless the human says so.

## Establish the implementation checkout first

Before editing product files, inspect the repository state and the plan's `Repo root`, `Base branch`, `Base source`, `Checkout convention`, and `Implementation branch or worktree` for this part. Use the exact planned part name. Check whether that branch or worktree already exists; resume it if it belongs to this part. Do not overwrite an existing ref or worktree, move unrelated changes, or discard a dirty checkout. Resolve a collision or unclear ownership with the human.

- For `Regular branches`, create or switch to the planned branch from the recorded base branch, then verify the active branch before editing.
- For `Worktrees`, create or enter a worktree on the planned branch from the recorded base branch, then verify both its branch and path before editing. Use a documented worktree location if present; otherwise choose a safe, non-colliding sibling of the repository and record the actual path in the plan.

If the base ref is missing, earlier parts have not been incorporated into it, or the plan's checkout convention is unresolved, stop and ask for the needed direction. Do not silently use the current branch or change the planned base. Keep the plan file accessible from the implementation checkout; when the plan lives in the repository, update the copy on the part branch or worktree.

## Implement and verify the part

Implement the selected part's outcome and acceptance criteria, including the test additions or updates specified under `Verification > Tests`. Inspect existing behavior before editing and follow repository instructions. Keep changes within the selected part, except for necessary supporting changes. Run the relevant automated tests and executable verification steps specified by the plan, plus focused checks needed for the actual changes. Do not claim a manual, external, or unavailable check passed; identify what remains for the human.

Reconcile the part's acceptance criteria, expected results, and verification steps with the result. In `Actual implementation and changes`, record the changes, deviations, reasons, test commands and results, and any human review changes. Follow the plan's completion protocol: correct outdated plan text in place with a short reason, and mark the part done with the device date and time only when its required completion and verification are satisfied. If implementation is complete but a required check remains, leave a truthful in-progress status and record the pending check. Do not advance to another part in this invocation.

## Commit decision and handoff

After implementation and available verification, put the question of whether to commit this part's changes or leave them uncommitted as the first item under `Next steps`, unless the human already supplied that choice in the invocation or later instructions. Do not commit before receiving the answer. If they choose a commit, include only this part's intended changes and use a meaningful message; if they choose uncommitted, leave them in place. Do not push or open a pull request unless requested.

In the final response, repeat the same acceptance criteria in their original order. For each criterion, state how it was implemented and verified, or mark it pending with the specific reason and remaining work. Do this even when the part is blocked or only partly implemented; do not imply a pending criterion is satisfied.

Always include `Next steps` in the final response. When the commit choice is still open, ask for it first, before other next steps. List every step in the selected part's `Verification` section and mark its agent result as `Passed`, `Failed`, or `Not run`, with the observed result or reason. A step requiring human verification remains `Not run` by the agent until the human completes it; include its expected outcome and the action needed. State the specific action needed for every other outstanding item, including tests specified for this part that were not developed. Distinguish these from useful tests outside this part's specified test work. If nothing else remains for this part, say so and identify the next plan part when one exists. Also report the part's completion state or exact blocker, branch and worktree path if applicable, implementation summary, test results, and commit state. Do not present an unverified part as complete.
