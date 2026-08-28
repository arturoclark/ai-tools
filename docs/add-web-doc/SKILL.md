---
name: add-web-doc
description: Crawl and index a website into the gnosis-mcp knowledge base.
argument-hint: <URL>
---

Crawl and index a website into gnosis-mcp with $ARGUMENTS.

## Steps

1. Ask for the **URL** (docs root) if not provided in $ARGUMENTS — include `https://` (or `http://` if the user insists).
2. Prefer **`crawl … --sitemap`** when the user wants sitemap-based discovery (default), unless they specify link-crawl depth or paths.
3. Run gnosis-mcp crawl:
   - Use `uv tool run --with 'gnosis-mcp[web]' gnosis-mcp crawl <url> --sitemap`
   - Add `--with 'gnosis-mcp[web,embeddings]'` and `--embed` when the user wants vector search.
   - Example: `uv tool run --with 'gnosis-mcp[web,embeddings]' gnosis-mcp crawl <url> --sitemap --embed`
4. Confirm knowledge was added:
   - Run `uv tool run gnosis-mcp stats` (use `--with 'gnosis-mcp[embeddings]'` if crawl used `--embed`) and **show the user the output**.
   - Optionally run `check`.
5. Remind the user: after search hits, use `mcp__gnosis-mcp__get_doc` for full content.
