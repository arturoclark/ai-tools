# Codex SLA Lifecycle Hooks Plan

## Goal

Replace the intrusive Codex stop-hook continuation with lifecycle automation that:

- discovers a repository-local `.sla` manifest file at session start and automatically loads the selected SLA profile context into Codex as hidden developer context;
- establishes a durable, non-intrusive persistence pipeline that can later evaluate a finished session outside the active Codex agent loop; and
- introduces the external-model persistence path first in audit/propose mode, so it cannot mutate a profile until its output quality has been evaluated.

## Scope and assumptions

- The initial implementation target is the Codex adapter. Claude, Cursor, and Hermes behavior remains unchanged unless a shared CLI surface can be safely reused without changing their installers.
- `.sla` means a repository-local manifest file, distinct from the existing global SLA home (`~/.sla`). It is configuration only and must never contain API keys or copied profile memory.
- Session-start context is intentionally supplied as Codex `SessionStart.additionalContext`: it is not displayed as a synthetic user message, although it does consume model context tokens.
- The existing `Stop` hook must stop returning `decision: "block"`; that mechanism creates the unwanted continuation prompt.
- Persistence must not run a remote model call directly in `SessionEnd`: Codex limits `SessionEnd` to three seconds. The hook must enqueue durable work and return quickly.
- The provider, model, key-storage mechanism, transcript redaction policy, and autonomous-write threshold are not selected yet. The implementation therefore starts with an audit-only provider contract and no persistent writes.
- API keys must not be stored in `.sla`, command-line arguments, transcripts, or audit artifacts.
- Automated tests must use temporary SLA homes and generated fixture profiles. A separate, opt-in manual integration check may read one user-selected existing populated profile for SessionStart validation, but must never mutate it.

## Execution context

- Repo root: `/Users/arturoclark/development/ai-tools/self-learning-agent`
- Plan file: `plans/2026-09-01-codex-sla-lifecycle.plan.md`
- Current branch: `master`
- Base branch: `master`
- Base source: Not specified; use the local `master` branch as directed.
- Implementation SLA profile(s): None. Do not use an SLA profile for this implementation.
- Test strategy/status: Existing Node test suite is `node --test` (`npm test`); relevant integration coverage is consolidated in `test/cli.test.js`. New unit/integration fixtures must be added to that suite.

## Worktree branch convention

The user directed development on `master` with no worktrees or branch switching. Planned branch labels are retained solely to preserve plan-part identity; do not create them.

- `codex-sla-lifecycle-part-01`
- `codex-sla-lifecycle-part-02`
- `codex-sla-lifecycle-part-03`
- `codex-sla-lifecycle-part-04`
- `codex-sla-lifecycle-part-05`

## Parts

### Part 1: Repository `.sla` manifest and profile resolution

Status: Complete
Completed at: 2026-09-01 18:09 MST
Worktree branch: `codex-sla-lifecycle-part-01` (do not create; implement on `master`)

#### What to achieve

Give a repository an explicit, portable way to select the SLA profiles that Codex should load automatically when a session starts in that repository, and provide the CLI command that creates that manifest in the current directory.

#### Technical details

- Add a repository-configuration module under `src/lib/` that walks upward from an input working directory to locate the nearest `.sla` file, stopping at the filesystem root. Define nearest-manifest precedence when nested directories each contain an `.sla` file.
- Define and document a versioned, inspectable `.sla` file format with an explicit ordered `profiles` list. Validate every profile name using the existing profile validation rules, reject duplicate names, and load the canonical bootstrap context for every configured profile in that order.

  Proposed first-release `.sla` file:

  ```json
  {
    "schemaVersion": 1,
    "profiles": ["self-learning-agent", "shared-engineering"]
  }
  ```

  The file contains routing metadata only: no profile contents, provider settings, API keys, transcript paths, or other secrets. `sla session install --profile self-learning-agent --profile shared-engineering` writes this exact structure with the supplied ordered profile names.
- Add a CLI command such as `sla session install --profile <name> [--profile <name> ...]` that writes `.sla` in the current working directory. It must validate that every requested profile exists, make overwrite behavior explicit (`--yes` or an interactive confirmation), and return the manifest path plus configured profile names in JSON mode.
- When the current directory already contains `.gitignore`, append the exact `.sla` entry unless an equivalent entry already exists. Preserve the file’s existing contents and newline convention, report whether `.gitignore` changed, and do not create a new `.gitignore` when one is absent.
- Do not treat a bare directory name as a profile name and do not silently select the global default profile.
- Resolve every configured profile through existing SLA profile APIs and generate each existing canonical `getProfileContext` output. Return a machine-readable result with: manifest path, repository root/containing directory, ordered profile entries, profile paths, and rendered contexts.
- Add a new `sla session bootstrap` command (exact final command name to be confirmed during implementation) that accepts a cwd/path and a Codex-oriented JSON output mode. It must distinguish: no `.sla` file, malformed manifest, missing profile, and valid resolved profiles without printing credentials or unrelated global configuration.
- Keep global `~/.sla` behavior unchanged. A repository marker routes to a global profile; it does not create a second profile store.
- Update README/help documentation with manifest creation and profile-routing examples, including the fact that `.sla` must be committed only if its selected profile name is appropriate for collaborators.

#### Expected results

From any directory inside a configured repository, SLA can deterministically identify the configured existing profiles and produce the compact canonical bootstrap context. `sla session install --profile ...` creates that manifest in the current directory. In unconfigured repositories, SLA reports no applicable profile without falling back silently to the global default.

#### Verification

• Backend

1. Add focused tests for upward discovery, nearest-marker precedence, valid and malformed `.sla` parsing, multiple profiles, duplicate profiles, missing profiles, and running from a nested directory.
   Expected result: every routing outcome has a stable machine-readable result and no implicit default-profile selection.

2. Add CLI tests for `sla session install --profile <name>` and repeated `--profile` arguments, including profile validation, safe overwrite behavior, existing `.gitignore` updates, duplicate ignore-entry prevention, and no-`.gitignore` behavior.
   Expected result: a valid call creates the exact `.sla` file in the current directory; it lists the configured profiles, cannot overwrite a manifest without explicit confirmation, appends `.sla` to an existing `.gitignore` exactly once, and does not create `.gitignore` when it is absent.

3. Add CLI tests for the bootstrap command’s JSON and human output modes.
   Expected result: valid configuration returns the configured profiles’ canonical context; no-marker and invalid-marker outcomes are distinguishable and non-destructive.

4. Run `npm test`.
   Expected result: the new tests and the existing `node --test` suite pass.

Result: `npm test` passed on 2026-09-01 (55 tests). The implementation provides `sla session install` and `sla session bootstrap`; valid manifests resolve named existing profiles in manifest order, while no-manifest, malformed-manifest, and missing-profile outcomes remain distinct.

#### Completion protocol

1. Mark the part as done with the device date and time.
2. Re-check the `Verification` and `Expected results` sections against the actual implementation.
3. If anything changed, strike through the outdated text, add a short reason, and add the corrected text directly in the same section.
4. No SLA profile is assigned for this plan; do not use `sla-use-profile` for implementation or verification.
5. Create or update the tests described for this part.
6. Run the relevant test commands and record the result in this plan.

#### Tests to add or update

- Add repository-discovery and `.sla` manifest-validation unit coverage, either in a new focused test file or the existing CLI test suite according to the project’s test organization.
- Extend `test/cli.test.js` for `sla session install`, `.gitignore` update/idempotency behavior, `sla session bootstrap`, overwrite, and failure contracts.

### Part 2: Silent Codex SessionStart installation and bootstrap

Status: Complete
Completed at: 2026-09-01 18:31 MST
Worktree branch: `codex-sla-lifecycle-part-02` (do not create; implement on `master`)

#### What to achieve

Install a Codex `SessionStart` hook that automatically loads repository-selected profile context without creating a user-visible continuation message, while removing the intrusive persistence behavior from the current `Stop` hook.

#### Technical details

- Extend the Codex adapter in `src/lib/hosts.js` to generate and install a managed session-start script alongside the existing hook files.
- Merge a managed `SessionStart` entry into the global or repository-local `hooks.json`, preserving unrelated hook groups and entries exactly as the current stop-hook merger does. Match `startup|resume|clear|compact` unless implementation evidence shows a narrower matcher is required.
- The generated script receives Codex hook JSON on stdin, uses `cwd`, invokes the new SLA bootstrap command safely, and writes only valid `SessionStart` JSON to stdout.
- For a valid `.sla` manifest, return `hookSpecificOutput.additionalContext` containing the compact context for the configured profiles. For no marker, return success with no output. For invalid markers or missing profiles, decide and document whether to emit a concise developer warning or silently no-op; do not expose internal paths, secrets, or full error stacks.
- Include a compact operating-policy block in the returned additional context that replaces the essential session-start behavior of `/sla-use-profile` for every configured profile:
  - state that the named profiles are active for this repository and all later `sla` operations must be scoped to the correct profile;
  - state that the injected profile snapshot already contains the SOUL, durable memory/user-memory entries, and compact skill index;
  - instruct the agent to use `sla soul view <profile>` or `sla memory list/view <profile>` only when it needs a fresh or more specific view than the injected snapshot;
  - state explicitly that the skill index is not the full skill body, and require `sla skill view <skill> <profile>` before relying on a listed skill that is relevant to the task;
  - instruct the agent to use `sla stats profile <profile>` only for activity/usage information, and `sla profile classify <profile>` when a later persistence target is ambiguous;
  - preserve the existing policy that SLA-managed data is changed through `sla` commands rather than direct edits under `~/.sla`.
- Do not inject the former mandatory end-of-turn persistence-review instruction in this hook. Part 3 and Part 4 replace that behavior with a silent, audit-only session-end pipeline; explicit `/use-profile` remains available when a user intentionally changes or adds profiles during a session.
- Ensure the script does not use raw stdout from `sla` as an unchecked protocol payload. Parse the bootstrap command’s JSON, then construct the documented Codex hook response.
- Replace the existing generated `sla-stop-hook.js` behavior. During this phase it must no longer block, emit a reason, or request persistence. Either omit its managed `Stop` config altogether or replace it with a silent enqueue-only hook introduced in Part 3; select one migration path and remove obsolete config idempotently.
  - ~~Remove the managed Stop hook during Part 2.~~ Reason: the user needs the legacy hook available to compare its persistence behavior against the later pipeline. Corrected: install both managed Codex hooks and provide `sla host uninstall-hooks codex` to remove both SLA-managed hook entries and scripts while preserving unrelated hooks.
- Update host-install status and overwrite detection so a prior installation migrates cleanly: stale managed stop entries/scripts are identified and removed or replaced without deleting unrelated user hooks.
- Update Codex-specific README instructions and generated `/use-profile` skill language: `/use-profile` remains available for an explicit profile override, but a repository `.sla` bootstrap is the default session entrypoint.
- Add an opt-in manual SessionStart integration procedure controlled by an explicit environment variable such as `SLA_LIFECYCLE_EXISTING_PROFILE`. It must verify that the named existing profile is non-empty before use, create a temporary repository `.sla` manifest pointing to it, start a Codex session, and compare the injected bootstrap context with `sla profile context <profile> --json`. The procedure must not run any SLA mutation command against that real profile.

#### Expected results

Starting, resuming, clearing, or compacting a Codex session in a configured repository loads the selected profile as hidden developer context. It never creates the old synthetic “persistence review” conversation turn. Sessions outside configured repositories behave normally.

The agent receives the same profile-scoping and lazy-skill-loading guidance supplied by `/sla-use-profile`: it knows the profile snapshot is active, treats the injected skill list as an index, and views a complete skill only when that skill is relevant.

#### Verification

• Backend

1. Add fixtures that execute the generated SessionStart script with Codex-shaped stdin for a configured repository, multiple configured profiles, no marker, malformed marker, and missing profile.
   Expected result: only the configured-repository fixture returns valid `SessionStart.additionalContext`, including active-profile, lazy-skill-view, scoped-command, and direct-edit policy guidance; all outputs are valid hook protocol JSON or intentionally empty success.

2. Extend Codex host-install tests to assert the merged `SessionStart` configuration, preservation of unrelated hooks, idempotent reinstallation, and removal/migration of the old managed blocking `Stop` entry.
   Expected result: Codex hooks configuration contains one managed session-start entry and no SLA entry that returns `decision: "block"` for persistence.

3. Run `npm test`.
   Expected result: generated-hook protocol tests, installer tests, and all existing tests pass.

• Frontend

4. In a trusted local test repository with a valid `.sla` manifest, start or resume a Codex session and inspect its hook status/event behavior.
   Expected result: profile context is available to the agent without a generated user-message continuation; an unconfigured repository receives no SLA bootstrap content.

5. Run the opt-in populated-profile integration procedure with `SLA_LIFECYCLE_EXISTING_PROFILE` set to one of the user’s existing profiles that contains memories and/or skills.
   Expected result: the session-start hook injects context equivalent to `sla profile context` for that profile and its skill index, while the profile’s pre-run and post-run state is identical.

#### Completion protocol

1. Mark the part as done with the device date and time.
2. Re-check the `Verification` and `Expected results` sections against the actual implementation.
3. If anything changed, strike through the outdated text, add a short reason, and add the corrected text directly in the same section.
4. No SLA profile is assigned for this plan; do not use `sla-use-profile` for implementation or verification.
5. Create or update the tests described for this part.
6. Run the relevant test commands and record the result in this plan.

#### Tests to add or update

- Extend `test/cli.test.js` to cover Codex SessionStart installation, config merge/migration, and generated-script output.
- Add script-level fixtures for all bootstrap success and failure cases, including compact/resume session sources.
- Add a documented opt-in integration script/test that refuses to run without `SLA_LIFECYCLE_EXISTING_PROFILE`, verifies the target has existing data, and snapshots it before/after to prove read-only SessionStart behavior.

Verification recorded 2026-09-01 18:31 MST: `npm test` passed. Generated-hook tests cover configured multiple profiles and startup/resume/clear/compact sources, plus no marker, malformed marker, and missing profile silent no-ops. Installer tests cover SessionStart merge, preservation of the legacy Stop hook, idempotent reinstall, and managed-hook uninstall.

### Part 3: Session persistence job contract and local audit queue

Status: Pending
Completed at:
Worktree branch: `codex-sla-lifecycle-part-03` (do not create; implement on `master`)

#### What to achieve

Define a safe, provider-independent persistence-job format and queue it silently when a Codex session ends, without modifying any SLA memory, skill, or reference.

#### Technical details

- Add a `sla session enqueue-persistence` command that accepts only hook-provided metadata: session ID, transcript path, cwd, and resolved repository/profile routing information. Its synchronous work must be bounded to validation, deduplication, and durable job creation.
- Design a versioned job schema stored under SLA-managed state, including immutable source metadata, profile selection, transcript fingerprint, timestamps, routing outcome, redaction-policy version, lifecycle source, and audit status. It must never store an API key.
- Add idempotency based on session ID plus transcript fingerprint so session shutdown/retries cannot create duplicate evaluations.
- Snapshot the minimum needed input at enqueue time or retain a guarded transcript reference; select the approach based on privacy, retention, and transcript-lifecycle behavior. Do not assume Codex transcript format is stable.
- Add a Codex `SessionEnd` hook that calls the enqueue command and emits no stdout on success. It must finish within Codex’s three-second SessionEnd limit.
- Keep the persistence worker disabled by default. Enqueued jobs remain auditable pending work until a user deliberately configures and runs an evaluator.
- Add status/list commands for pending, completed, skipped, and failed jobs, with redacted diagnostics and no transcript content by default.
- ~~Update the installer and migration logic to install the `SessionEnd` hook without reintroducing the old `Stop` continuation.~~ Reason: legacy Stop must remain available for the comparison period. Corrected: install `SessionEnd` alongside `SessionStart` and the legacy managed `Stop` hook; preserve unrelated hooks. Part 6 retires the legacy Stop hook.
- Seed every queue test with a disposable profile in a temporary `SLA_HOME` that contains representative soul, memory, user-memory, skill, and reference data. Use a separate disposable profile per test case or reset its temporary home between cases; never queue, evaluate, or mutate a user’s actual profile.

#### Expected results

Finishing a Codex session silently records one deduplicated, profile-routed persistence job. No profile content changes, no provider request is made, and no user-visible message is injected.

#### Verification

• Backend

1. Add tests for job-schema validation, stable job IDs/fingerprints, duplicate SessionEnd delivery, no-marker sessions, missing transcript paths, and atomic queue writes.
   Expected result: each session produces at most one valid queued job and failure states are inspectable without leaking transcript contents.

2. Add generated SessionEnd hook tests using Codex-shaped stdin and a short command timeout.
   Expected result: the hook writes no stdout on successful enqueue, exits within the configured limit, and does not alter a profile.

3. Extend installer tests for merged SessionEnd config and coexistence with SessionStart, the legacy Stop hook, and unrelated hooks.
   Expected result: a re-run remains idempotent, keeps the legacy Stop hook available for comparison, and does not duplicate any managed hook.

4. Run `npm test`.
   Expected result: queue, hook, installer, and regression tests pass.

5. Inspect the disposable profile after every enqueue fixture.
   Expected result: its soul, memories, skills, and references exactly match the pre-enqueue snapshot because Part 3 is queue-only.

#### Completion protocol

1. Mark the part as done with the device date and time.
2. Re-check the `Verification` and `Expected results` sections against the actual implementation.
3. If anything changed, strike through the outdated text, add a short reason, and add the corrected text directly in the same section.
4. No SLA profile is assigned for this plan; do not use `sla-use-profile` for implementation or verification.
5. Create or update the tests described for this part.
6. Run the relevant test commands and record the result in this plan.

#### Tests to add or update

- Add focused persistence-job/queue tests.
- Extend `test/cli.test.js` for enqueue/status commands and Codex SessionEnd installation.
- Add fixtures proving that an enqueued job never mutates memory, skills, or references.
- Add a reusable seeded dummy-profile factory and pre/post-state assertion helper for all persistence-related tests.

### Part 4: Provider evaluator in audit/propose mode

Status: Pending
Completed at:
Worktree branch: `codex-sla-lifecycle-part-04` (do not create; implement on `master`)

#### What to achieve

Evaluate queued session jobs with a configured independent model and persist only a structured, reviewable proposal—not profile mutations—so proposal quality can be measured before autonomous persistence is considered.

#### Technical details

- Define a provider adapter interface rather than hard-coding OpenAI, Claude, Kimi, or a common API dialect. The adapter receives a sanitized evaluation packet and returns a validated structured proposal.
- Introduce explicit user configuration for provider, model, credential reference, evaluation policy, and opt-in state. The hook/worker must retrieve a previously stored credential noninteractively; it cannot depend on an interactive prompt or a manually exported environment variable at session end.
- Add an SLA CLI setup command such as `sla persistence configure --provider <provider> --model <model> --api-key-stdin`. The user runs it once outside the hook; the command reads the key from stdin, stores it in the operating system credential store under an SLA-owned service/account name, and saves only an opaque credential reference plus provider/model/policy metadata in SLA configuration. The command must never echo the key or write it to shell history, `.sla`, job data, transcripts, audit proposals, logs, or JSON output.
- Add `sla persistence configure --status`, `sla persistence configure --remove`, and provider/model update flows that report credential presence without revealing secret material. Fail evaluation with a concise recoverable configuration error if the credential reference cannot be resolved.
- Do not support raw `--api-key <value>` arguments. Environment-variable references may be considered only as an explicitly documented fallback for platforms without a usable credential store; the default and tested path is OS credential storage.
- Define the transcript preparation pipeline: parse only recognized transcript records, select relevant user/assistant/tool material, redact configured secret patterns, exclude system/developer instructions by default, cap size deterministically, and record what was omitted. Treat unparseable transcript records as a safe failure, not as content to upload.
- Include the selected profile’s canonical context, current memory/skill index, and a strict persistence taxonomy in the evaluation packet. Require provider output to conform to a JSON schema with `no_change`, memory, user-memory, skill, and reference proposals plus evidence pointers and confidence.
- Add `sla session evaluate <job>` and a batch/worker command that process only pending jobs. In this phase, they write proposal/audit artifacts and evaluation status only; no `sla memory` or `sla skill` mutation calls are allowed.
- Add clear cost/privacy warnings before provider configuration and a local inspection command to review the exact sanitized packet shape without making a network request.
- Design quality-evaluation fields: reviewer verdict, accepted/rejected proposal items, false-positive category, duplicate category, and later comparison against manual/in-session persistence. Do not implement autonomous application in this part.
- Establish a comparison harness before enabling any real provider: seed a disposable profile with the same starting state, provide a controlled transcript fixture, and preserve a human-reviewed baseline proposal from the legacy Stop-hook workflow. Compare the external evaluator’s proposal to that baseline by semantic item/routing rubric—not byte-for-byte wording—and record missing durable items, false positives, duplicates, wrong memory-vs-skill/reference routing, and unsupported edits.
- Document retention, deletion, retry/backoff, provider error behavior, and how to disable or purge pending audit jobs.

#### Expected results

A user who explicitly configures a provider can process queued jobs into structured, redacted, inspectable persistence proposals. The workflow sends no key through command arguments and makes no SLA profile changes.

#### Verification

• Backend

1. Add adapter-contract tests with a fake provider for valid proposals, invalid JSON/schema responses, timeouts, retryable failures, and no-change decisions.
   Expected result: only validated proposals are stored; failed evaluations expose safe diagnostics and never mutate a profile.

2. Add transcript-preparation fixtures containing secrets, malformed records, oversized content, system/developer content, relevant tool results, and multiple profile markers.
   Expected result: the evaluator packet follows the selected redaction and routing policy, records omissions, and never contains prohibited fixture secrets.

3. Add CLI tests for provider configuration via stdin, credential-reference persistence, status/remove behavior, packet preview, evaluation, proposal listing/viewing, and disabled-default behavior. Use a credential-store test double; no real secret store or real key is used in automated tests.
   Expected result: raw API-key flags are rejected or unavailable; the hook/worker can resolve the stored credential reference noninteractively; command output, configuration, jobs, and proposals contain no key; and an unconfigured or unavailable credential cannot start evaluation.

4. Run `npm test`.
   Expected result: all evaluator, privacy, queue, hook, and existing regression tests pass without a real provider call.

5. Run the baseline-comparison harness against the fake provider and against an explicitly configured real provider only after packet preview approval.
   Expected result: the harness reports semantic agreement and disagreement against the legacy Stop-hook baseline; the disposable profile remains byte-for-byte unchanged because audit mode cannot apply proposals.

• Frontend

5. In a controlled test repository, run a real configured provider only after reviewing the packet-preview output and use a transcript fixture with known expected proposals.
   Expected result: the audit proposal is reviewable, contains no intentionally seeded secret, can be assessed against the legacy Stop-hook baseline, and leaves the selected dummy SLA profile unchanged.

#### Completion protocol

1. Mark the part as done with the device date and time.
2. Re-check the `Verification` and `Expected results` sections against the actual implementation.
3. If anything changed, strike through the outdated text, add a short reason, and add the corrected text directly in the same section.
4. No SLA profile is assigned for this plan; do not use `sla-use-profile` for implementation or verification.
5. Create or update the tests described for this part.
6. Run the relevant test commands and record the result in this plan.

#### Tests to add or update

- Add fake-provider contract and schema-validation tests.
- Add transcript redaction and packet-preview fixtures.
- Extend CLI coverage for evaluator configuration, jobs, and audit proposal inspection.
- Add credential-store adapter tests covering stdin setup, noninteractive retrieval by the worker, status/remove, unavailable store, and proof that no secret reaches persisted SLA artifacts or command output.
- Add a semantic baseline-comparison fixture and rubric covering durable-memory recall, no-change decisions, skill creation/update, reference creation, duplicate avoidance, and correct storage routing.

### Part 5: Lifecycle-hook installation and external persistence documentation

Status: Pending
Completed at:
Worktree branch: `codex-sla-lifecycle-part-05` (do not create; implement on `master`)

#### What to achieve

Publish a complete README workflow that lets a user install the new Codex lifecycle integration, configure repository profile loading, securely configure the external audit evaluator, and verify that both hooks are active without exposing a key or creating user-visible persistence turns.

#### Technical details

- Update `README.md` with a Codex lifecycle quickstart in exact execution order:
  1. install/initialize SLA;
  2. install or upgrade the Codex host integration with `sla host install codex` (and the repository-local variant where supported);
  3. create a repository `.sla` manifest using `sla session install --profile <name> [--profile <name> ...]` and describe its automatic `.gitignore` update behavior;
  4. explain that `SessionStart` loads the configured profiles as hidden developer context, including a compact skill index, and that `sla skill view` is still required for full relevant skills;
  5. configure the audit evaluator with `sla persistence configure --provider <provider> --model <model> --api-key-stdin`, showing a safe stdin example that does not put the secret on the command line;
  6. inspect configuration with the status command, inspect queued jobs/proposals, and remove credentials with the remove command.
- Document precisely what each installed hook does and does not do:
  - `SessionStart` finds the nearest `.sla` file and adds profile context invisibly to the agent;
  - `SessionEnd` silently queues a persistence job and does not add a continuation message or mutate profile content;
  - the evaluator runs only after explicit provider configuration and produces audit/propose artifacts only in this release.
- Include the `.sla` JSON example and explain that it contains ordered profile names only, must not contain credentials, and is ignored automatically only when an existing `.gitignore` is present.
- Add troubleshooting for missing/invalid `.sla`, missing selected profiles, an untrusted repository-local Codex hook configuration, unavailable stored credential, disabled evaluator, provider failure, and why a job may produce `no_change`.
- Include privacy and cost disclosures: the configured provider receives only the evaluator’s prepared/redacted packet, external evaluation is opt-in, no raw key is stored in `.sla`, and audit mode does not apply proposals to profiles.
- Update command help/examples wherever they expose the new install, bootstrap, queue, configuration, status, review, and removal workflows, keeping README examples synchronized with actual CLI behavior.

#### Expected results

A new user can follow the README to install both lifecycle hooks, create `.sla`, confirm automatic profile bootstrap, configure a stored external-provider credential, and inspect silent audit persistence without needing the legacy `/use-profile` flow or guessing where a secret is stored.

#### Verification

• Backend

1. Add or update CLI help snapshot/assertion tests for every README command and option shown in the lifecycle quickstart.
   Expected result: each documented command parses successfully and its documented output/error behavior matches the implementation.

2. Run `npm test`.
   Expected result: help, installer, hook, queue, and provider-configuration regression coverage passes.

• Frontend

3. Follow the README quickstart in a clean temporary SLA/Codex home and temporary repository, using a fake credential-store/provider adapter where real external credentials are unavailable.
   Expected result: the documented commands create the expected hook configuration and `.sla` manifest, SessionStart is silent to the user, and SessionEnd only queues an audit job.

4. Review README code blocks for key safety and copy/paste correctness.
   Expected result: no example passes a secret as a normal command-line argument, commits a secret, or claims audit proposals are automatically applied.

#### Completion protocol

1. Mark the part as done with the device date and time.
2. Re-check the `Verification` and `Expected results` sections against the actual implementation.
3. If anything changed, strike through the outdated text, add a short reason, and add the corrected text directly in the same section.
4. No SLA profile is assigned for this plan; do not use `sla-use-profile` for implementation or verification.
5. Create or update the tests described for this part.
6. Run the relevant test commands and record the result in this plan.

#### Tests to add or update

- Extend CLI/help tests for every public lifecycle command documented in the README.
- Add a clean-environment documentation smoke-test script or fixture that follows the README quickstart using test doubles.

### Part 6: Legacy Codex Stop-hook retirement

Status: Pending
Completed at:
Worktree branch: `codex-sla-lifecycle-part-06` (do not create; implement on `master`)

#### What to achieve

Retire the legacy blocking Codex `Stop` hook only after the SessionStart, SessionEnd, audit queue, evaluator, and lifecycle documentation have been implemented and compared against the legacy workflow.

#### Technical details

- Until this part, `sla host install codex` continues to install both the legacy managed `Stop` hook and the new lifecycle hooks so their persistence behavior can be compared.
- In this part, change `sla host install codex` so it installs only the lifecycle hooks: `SessionStart` and `SessionEnd`. It must no longer create, rewrite, or add the legacy `sla-stop-hook.js` or its managed `Stop` configuration entry.
- Treat a regular host reinstall as the explicit migration path: remove the managed legacy Stop entry and `sla-stop-hook.js` while preserving unrelated user Stop hooks, SessionStart/SessionEnd hooks, skills, and host configuration.
- Keep `sla host uninstall-hooks codex` as the explicit full managed-hook removal command; it removes SLA-managed Stop, SessionStart, and SessionEnd hooks if present, while preserving unrelated hooks.
- Update host status, overwrite detection, help text, README material, and generated `/use-profile` language to describe lifecycle hooks as the default and legacy Stop persistence as retired.
- Do not remove the legacy hook before the comparison harness in Part 4 has recorded its reviewed baseline.

#### Expected results

After this part, a fresh or upgraded `sla host install codex` installs no blocking legacy Stop hook. Existing unrelated host hooks remain intact, and silent SessionStart/SessionEnd lifecycle behavior is the sole SLA lifecycle integration.

#### Verification

• Backend

1. Install Codex hooks into a fixture containing managed legacy Stop plus unrelated Stop hooks and lifecycle hooks; rerun `sla host install codex --yes`.
   Expected result: the managed legacy Stop entry/script is removed, unrelated Stop hooks remain unchanged, and exactly one managed SessionStart and SessionEnd entry remain.

2. Install into a clean fixture.
   Expected result: no `sla-stop-hook.js` or managed blocking Stop configuration is created.

3. Run `sla host uninstall-hooks codex` against fixtures containing any combination of old and new SLA hooks.
   Expected result: all SLA-managed hooks are removed idempotently without changing unrelated hooks or host skills.

4. Run `npm test`.
   Expected result: lifecycle, migration, uninstall, and regression tests pass.

#### Completion protocol

1. Mark the part as done with the device date and time.
2. Re-check the `Verification` and `Expected results` sections against the actual implementation.
3. If anything changed, strike through the outdated text, add a short reason, and add the corrected text directly in the same section.
4. No SLA profile is assigned for this plan; do not use `sla-use-profile` for implementation or verification.
5. Create or update the tests described for this part.
6. Run the relevant test commands and record the result in this plan.

#### Tests to add or update

- Extend `test/cli.test.js` with clean-install, upgrade-migration, and idempotent managed-hook-uninstall coverage.
- Add fixtures proving that legacy Stop behavior remains available through Parts 2–5 and is removed only by Part 6 migration.

## Open questions

- What exact `.sla` file format should the first release use beyond its required ordered `profiles` list and version field?
- Should a malformed `.sla` manifest add a concise hidden developer warning at SessionStart, or silently disable SLA bootstrap for that session?
- Should `.sla` be intended for source control by default, and if so should the installer offer a `.gitignore` option or a template command?
- Which provider should be implemented first for audit mode? The credential-storage default is the operating system credential store, with an environment-variable fallback considered only for unsupported platforms.
- What transcript-retention and redaction policy is acceptable before any transcript-derived content may be sent to a third-party provider?
- What measurable acceptance bar (for example, reviewed proposal precision and false-positive rate across a representative sample) must be met before planning autonomous apply mode?
- Which existing populated profile should be supplied through `SLA_LIFECYCLE_EXISTING_PROFILE` for the opt-in SessionStart smoke test? The available profiles are `aws`, `bookings-harness`, `bot-dev`, `default`, `minecraft-dev`, `myjour-dev`, `overseer`, `overseer-deprecated`, `overseer-harness`, `stripe-dev`, and `ziipco-dev`; this test will read it only.
