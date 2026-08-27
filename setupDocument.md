# custom-figma-mcp — Setup Guide (macOS)

This guide walks through setting up **custom-figma-mcp** — a local MCP (Model Context Protocol) proxy server that gives OpenCode read-only access to Figma files — on a Mac.

## Prerequisites

- Node.js v18 or later (nodejs.org)
- npm (bundled with Node.js)
- OpenCode installed and configured
- A Figma account with **view access** to the file(s) you want to inspect

Verify Node is installed:

```bash
node -v
npm -v
```

## Step 1: Clone the Repository

```bash
git clone https://github.com/<your-username>/custom-figma-mcp.git
cd custom-figma-mcp
```

## Step 2: Install Dependencies

```bash
npm install
```

This installs:

- `@modelcontextprotocol/sdk` — MCP server/transport primitives
- `axios` — HTTP client for Figma's REST API
- `dotenv` — loads environment variables from a `.env` file

## Step 3: Generate a Figma Personal Access Token (PAT)

1. Log in to Figma (web or desktop app).
2. Click your account avatar (top-left) → **Settings**.
3. Go to the **Security** tab.
4. Scroll to **Personal access tokens** → click **Generate new token**.
5. Name it something identifiable, e.g. `opencode-mcp-proxy`.
6. Under **Scopes**, select **File content: Read** (`file_content:read`) — read-only (better to give complete read access, i.e. all read access option/toggle), no write access.
7. Click **Generate token** and copy it immediately (it's shown only once).

> If you need to access files inside an organization/team, make sure the account that generated the token has at least **"Can view"** access to that file or team folder.
> 

## Step 4: Configure Environment Variables

Create a `.env` file in the project root:

```bash
touch .env
```

Add your token:

```
FIGMA_PAT=figd_your_actual_token_here
```


## Step 5: Register the Server with OpenCode

Open (or create) your global OpenCode config file:

```bash
~/.config/opencode/opencode.json
```

Add an entry under `mcp`, pointing to the **absolute path** of `index.js`:

```json
{
  "mcp": {
    "figma-dev": {
      "enabled": true,
      "type": "local",
      "command": ["node", "/absolute/path/to/custom-figma-mcp/index.js"]
    }
  }
}
```
Replace `/absolute/path/to/custom-figma-mcp/index.js` with the real path — for example:

```bash
/Users/<your-username>/projects/custom-figma-mcp/index.js
```
Tip: run `pwd` inside the project folder to get the exact absolute path.

-----------------------------

## *If you have multiple node versions, do these:*

### 5.1 List all the node versions
```shell
nvm ls
```
### 5.2 Select the node version which is higher than 18.x, and get the path of that node.
```shell
nvm which <the node you want to use>
```
example: nvm which v10.23.3
### 5.3 Add an entry under `mcp`, pointing to the **absolute path** of `index.js`:
```json
{
  "mcp": {
    "figma-dev": {
      "enabled": true,
      "type": "local",
      "command": ["<node path>", "/absolute/path/to/custom-figma-mcp/index.js"]
    }
  }
}
```

Replace `/absolute/path/to/custom-figma-mcp/index.js` with the real path — for example:

```bash
/Users/<your-username>/projects/custom-figma-mcp/index.js
```

Tip: run `pwd` inside the project folder to get the exact absolute path.

## Step 6: Restart OpenCode

Restart OpenCode (or reload its config) so it picks up the new MCP server. On startup, OpenCode will spawn the Node process automatically — you don't need to run `node index.js` manually.

## Step 7: Verify It Works

Open a chat with OpenCode and try:

```
Read this Figma wireframe: <your figma file URL>. Use get_figma_file_structure to list all available pages and top-level frames.
```

If everything is wired up correctly, OpenCode will call the `get_figma_file_structure` tool and return the page/frame hierarchy of your file.

## How to Reference a Figma File in Prompts

Grab any Figma file URL, e.g.:

```
https://www.figma.com/design/aBc123XyZ456/App-Wireframe?node-id=104-15
```

- **File Key** → `aBc123XyZ456` (string right after `/design/` or `/file/`)
- **Node ID** → `104-15` in the URL, but the API expects colons: `104:15`

You can paste the raw URL directly into your OpenCode prompt — no manual parsing needed.

## Troubleshooting

| Issue | Fix |
| --- | --- |
| `FIGMA_PAT environment variable is missing` | Ensure `.env` exists in the project root and the server was started from that directory |
| `403 Forbidden` from Figma API | Your token's account doesn't have view access to that file/team |
| OpenCode doesn't detect the tool | Double-check the absolute path in `opencode.json` and restart OpenCode |
| Large files time out or get truncated | Use `get_figma_node_details` on specific node IDs instead of pulling the whole file at once |


## Troubleshooting

*   **`FIGMA_PAT environment variable is missing`**
    *   **Fix:** Ensure the `.env` file exists in your project root.
    *   **Note:** Verify that you started the server directly from that specific root directory.

*   **`403 Forbidden` from Figma API**
    *   **Fix:** Check your Figma token permissions.
    *   **Note:** The account tied to your token does not have view access to that specific file or team.

*   **OpenCode doesn't detect the tool**
    *   **Fix:** Double-check the absolute file path inside your `opencode.json` configuration file.
    *   **Next Step:** Restart the OpenCode application to apply the changes.

*   **Large files time out or get truncated**
    *   **Fix:** Stop pulling the entire Figma file all at once.
    *   **Alternative:** Use the `get_figma_node_details` tool to target and request specific node IDs instead.

*   **`Figma API Error: unable to get local issuer certificate`**
    *   download the respective certificate and add it to the environment. 
    *   **Config Example:**
        ```json
        "figma-dev": {
          "enabled": true,
          "type": "local",
          "command": [
            "<node path>",
            "/Users/<username>/Desktop/custom-figma-mcp/index.js"
          ],
          "environment": {
            "NODE_EXTRA_CA_CERTS": "/Users/<username>/.config/opencode/certs/cisco-umbrella-ca.pem"
          }
        }
        ```

