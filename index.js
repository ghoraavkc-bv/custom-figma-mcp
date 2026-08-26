import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import axios from "axios";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, ".env") });

const FIGMA_TOKEN = process.env.FIGMA_PAT;

if (!FIGMA_TOKEN) {
  console.error("Error: FIGMA_PAT environment variable is missing in .env");
  process.exit(1);
}

const figmaApi = axios.create({
  baseURL: "https://api.figma.com/v1",
  headers: { "X-Figma-Token": FIGMA_TOKEN }
});

const server = new Server(
  { name: "figma-dev-reader", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

// Define tools exposed to OpenCode
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "get_figma_file_structure",
        description: "Get the high-level outline/page hierarchy of a Figma file (depth-limited to avoid massive JSON).",
        inputSchema: {
          type: "object",
          properties: {
            fileKey: { type: "string", description: "The key from your Figma URL: figma.com/design/:fileKey/..." },
            depth: { type: "number", description: "Traversal depth level (default: 2)", default: 2 }
          },
          required: ["fileKey"]
        }
      },
      {
        name: "get_figma_node_details",
        description: "Fetch deep CSS properties, auto-layout settings, constraints, styles, and text content for specific frame/element IDs.",
        inputSchema: {
          type: "object",
          properties: {
            fileKey: { type: "string", description: "The key from your Figma URL" },
            nodeIds: { 
              type: "array", 
              items: { type: "string" }, 
              description: "Array of node IDs (e.g. ['1:2', '104:15'])" 
            }
          },
          required: ["fileKey", "nodeIds"]
        }
      },
      {
        name: "get_figma_node_image",
        description: "Render and return a PNG image URL of specific components or frames for visual inspection.",
        inputSchema: {
          type: "object",
          properties: {
            fileKey: { type: "string", description: "The key from your Figma URL" },
            nodeId: { type: "string", description: "Node ID to render (e.g., '104:15')" },
            scale: { type: "number", description: "Render scale 1-4 (default: 2)", default: 2 }
          },
          required: ["fileKey", "nodeId"]
        }
      }
    ]
  };
});

// Handle commands execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (name === "get_figma_file_structure") {
      const depth = args.depth || 2;
      const res = await figmaApi.get(`/files/${args.fileKey}?depth=${depth}`);
      return {
        content: [{ type: "text", text: JSON.stringify(res.data, null, 2) }]
      };
    }

    if (name === "get_figma_node_details") {
      const idsParam = args.nodeIds.join(",");
      const res = await figmaApi.get(`/files/${args.fileKey}/nodes?ids=${encodeURIComponent(idsParam)}`);
      return {
        content: [{ type: "text", text: JSON.stringify(res.data, null, 2) }]
      };
    }

    if (name === "get_figma_node_image") {
      const scale = args.scale || 2;
      const res = await figmaApi.get(`/images/${args.fileKey}?ids=${encodeURIComponent(args.nodeId)}&scale=${scale}&format=png`);
      return {
        content: [{ type: "text", text: JSON.stringify(res.data, null, 2) }]
      };
    }

    throw new Error(`Unknown tool requested: ${name}`);
  } catch (err) {
    const errorDetails = err.response ? JSON.stringify(err.response.data) : err.message;
    return {
      content: [{ type: "text", text: `Figma API Error: ${errorDetails}` }],
      isError: true
    };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);