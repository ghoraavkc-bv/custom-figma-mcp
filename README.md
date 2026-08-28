A lightweight local **MCP (Model Context Protocol)** server that gives AI coding agents (like OpenCode) structured, read-only access to Figma files — file hierarchies, node properties, and rendered images — without needing Figma's hosted/remote MCP integration.

## How to let opencode know what figma page your working on
Open the figma page in your browser, copy the URL, give it to the opencode along with your prompt.

Figma's official remote MCP server is gated behind an allowlisted Client ID, which isn't practical for individual developers wiring up their own agent tooling. This project sidesteps that by talking directly to Figma's public REST API using a personal access token, exposed to the agent through a standard MCP tool interface over stdio.


## Why This Exists

Figma's official remote MCP server is gated behind an allowlisted Client ID, which isn't practical for individual developers wiring up their own agent tooling. This project sidesteps that by talking directly to Figma's public REST API using a personal access token, exposed to the agent through a standard MCP tool interface over stdio.

## Architecture

```
OpenCode (MCP client)
      │  stdio (JSON-RPC)
      ▼
custom-figma-mcp (this server)
      │  HTTPS + X-Figma-Token
      ▼
Figma REST API (api.figma.com/v1)
```

The server is a single Node.js process that:

1. Starts up and registers itself over `stdio` using `@modelcontextprotocol/sdk`.
2. Advertises a fixed set of tools to the MCP client (OpenCode) via `ListToolsRequestSchema`.
3. Executes tool calls via `CallToolRequestSchema`, proxying them to Figma's REST API with your personal access token attached as a header.
4. Returns structured JSON (or image URLs) back to the calling agent.

Because it only ever uses `GET` requests with a read-scoped token, it cannot modify, comment on, or delete anything in Figma — it's strictly read-only by design.

## Tools Exposed

### `get_figma_file_structure`

Returns the page/frame hierarchy of a file, depth-limited to avoid dumping the entire node tree (which can be tens of thousands of nodes on large files).

**Input:**

```json
{ "fileKey": "string", "depth": 2 }
```

**Maps to:** `GET /v1/files/:fileKey?depth=:depth`

### `get_figma_node_details`

Fetches full properties for specific node IDs — auto-layout config, padding/gap values, fills, strokes, typography, constraints, component properties, etc. This is the primary tool used for accurate code generation.

**Input:**

```json
{ "fileKey": "string", "nodeIds": ["1:2", "104:15"] }
```

**Maps to:** `GET /v1/files/:fileKey/nodes?ids=1:2,104:15`

### `get_figma_node_image`

Renders a specific node as a PNG and returns a temporary signed URL, useful for visually cross-checking generated code against the design.

**Input:**

```json
{ "fileKey": "string", "nodeId": "104:15", "scale": 2 }
```

**Maps to:** `GET /v1/images/:fileKey?ids=104:15&scale=2`

## Why Three Separate Tools (Instead of One)

Figma files can be enormous — a single `GET /files/:key` call with no depth limit can return megabytes of deeply nested JSON, which blows through an LLM's context window instantly. Splitting the interface into three targeted tools lets the agent:

1. First get a lightweight outline (`get_figma_file_structure`) to identify relevant frames/nodes.
2. Drill into only the specific nodes it needs (`get_figma_node_details`).
3. Optionally render an image only when visual confirmation is needed (`get_figma_node_image`).

This mirrors how a human developer would inspect a design — skim first, then zoom in — rather than ingesting the entire file at once.

## Authentication

Authentication uses a Figma **Personal Access Token** (PAT), scoped to `file_content:read`. The token is loaded from a local `.env` file (never hardcoded) and attached to every outbound request as the `X-Figma-Token` header. The token never leaves the local machine except in requests directly to `api.figma.com`.

## Error Handling

All tool handlers are wrapped in try/catch. On failure (invalid file key, no access, rate limiting, etc.), the server returns an MCP-compliant error response:

```json
{
  "content": [{ "type": "text", "text": "Figma API Error: <details>" }],
  "isError": true
}
```

This lets the calling agent see the actual failure reason instead of crashing silently.

## Project Structure

```
custom-figma-mcp/
├── index.js        # server entrypoint — tool definitions + handlers
├── package.json    # dependencies, "type": "module" for ESM imports
├── .env            # local only — holds FIGMA_PAT, never committed
└── .gitignore
```

## Local Development

Run the server directly for debugging (it communicates over stdio, so you won't see typical HTTP server logs):

```bash
node index.js
```

In practice, you don't run this manually — OpenCode spawns it as a subprocess based on the `command` defined in `opencode.json`.

## Extending This Server

To add a new tool:

1. Add its schema to the `tools` array returned by `ListToolsRequestSchema`.
2. Add a matching `if (name === "...")` branch inside the `CallToolRequestSchema` handler.
3. Map it to the relevant Figma REST endpoint under `figmaApi` (an `axios` instance pre-configured with the base URL and auth header).

Keep new tools read-only and scoped — avoid dumping full unfiltered API responses where possible, to keep agent context usage low.
