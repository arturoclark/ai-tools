---
name: handoff
description: Create a detailed handoff summary for the current working context and write it to a markdown file in the user's temp directory. Use when Codex needs to preserve important context for a later agent session, transfer work between agents, capture the current state before stopping, or create a scoped handoff for only a specified subset of the context such as a feature area, incident, file set, or decision thread.
---

# Handoff

Create a handoff that another agent can resume from without re-discovering important context. Optimize for completeness, accuracy, and continuation value.

## Inputs

Accept these user-provided parameters when present in the invocation text:

- `context-name`: Required output name stem. Use it in the filename `handoff-{context-name}.md`.
- `scope`: Optional subset boundary. Limit the handoff to the requested area when provided.

If `context-name` is not provided, derive a short stable slug from explicit context already available in the conversation or workspace. If a reliable slug is not available, say: `I don't know, help me get more context`.

If the requested scope is ambiguous and cannot be resolved from existing context, say: `I don't know, help me get more context`.

## Workflow

1. Determine the scope.
   Use the full current context by default.
   Narrow the handoff only when the user explicitly provides a scope or an equivalent constraint.

2. Gather only grounded facts.
   Include information from the current conversation, inspected files, commands you actually ran, outputs you actually observed, and edits that are present on disk.
   Do not infer hidden intent or fabricate missing history.

3. Write a continuation-oriented summary.
   Prefer concise sections and bullets.
   Include the facts another agent would otherwise need to rediscover.

4. Create the markdown file with `scripts/write_handoff.py`.
   Pass `--context-name` and pipe the markdown body through stdin.

5. Return the created file path in the final message.
   Use this form:
   `Handoff created at <absolute-path>. Start the next agent session by referencing this file and stating what should happen next.`

## Required Content

Include the relevant subset of these sections. Omit empty sections instead of filling them with placeholders.

- `# Handoff: <context-name>`
- `## Scope`
- `## Current State`
- `## Decisions`
- `## Changes Made`
- `## Files`
- `## Commands Run`
- `## Validation`
- `## Open Issues`
- `## Next Steps`

## Content Rules

- State concrete facts, not conclusions without evidence.
- Call out blockers, assumptions, and unresolved questions explicitly.
- Include exact file paths when they materially help continuation.
- Include exact command lines when they are likely to be rerun.
- Record failed attempts only when they change the next step or prevent repeated work.
- Keep the summary dense. Do not pad it with generic prose.

## File Creation

Use the bundled script:

```bash
python3 <skill-directory>/scripts/write_handoff.py --context-name "<slug>" <<'EOF'
<markdown content>
EOF
```

The script writes the file into `${TMPDIR}` when set, otherwise `/tmp`, and prints the absolute path.
