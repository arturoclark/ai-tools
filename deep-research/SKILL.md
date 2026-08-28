---
name: deep-research
description: Conduct deep research using the mcp-server-deep-research MCP server. Use this when the user asks for deep research on a topic.
argument-hint: <research topic or question>
---

Conduct deep research on $ARGUMENTS using the mcp-server-deep-research MCP server.

## Tools

Use the `mcp__mcp-server-deep-research__start_research` tool to perform the research.

## Rules

- Do not create MD files for research output — present results as text directly in the conversation, unless the user explicitly asks for a file.
- Never use a regular browser tool for research. Always use the brave search MCP tool (`mcp__brave-search__brave_web_search`) if additional searching is needed.
