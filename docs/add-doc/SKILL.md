---
name: add-doc
description: Index a local file or directory into gnosis-mcp knowledge base.
argument-hint: <file or directory path>
---

Index a local file or directory into gnosis-mcp with $ARGUMENTS.

## Steps

1. Ask for the **file or directory path** if not provided in $ARGUMENTS.
2. Resolve to an **absolute path** and confirm it exists.
3. Run **`gnosis-mcp ingest`** via **`uv tool run`**:
   - Use `--with 'gnosis-mcp[embeddings]'` and `--embed` unless the user only wants keyword index.
   - Example: `uv tool run --with 'gnosis-mcp[embeddings]' gnosis-mcp ingest <path> --embed`
4. Confirm knowledge was added:
   - Run `uv tool run gnosis-mcp stats` (use `--with 'gnosis-mcp[embeddings]'` if ingest used `--embed`) and **show the user the output**.
   - Optionally run `check` from gnosis-mcp.
5. Remind the user: after search hits, use `mcp__gnosis-mcp__get_doc` for full content.
