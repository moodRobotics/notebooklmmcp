import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { NotebookLMClient } from "./client.js";
import { AuthManager } from "./auth.js";
import chalk from "chalk";

const server = new Server(
  {
    name: "notebooklm-mcp-server",
    version: "1.0.5",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

let client: NotebookLMClient;

// Initialize client from saved auth or environment
try {
  const auth = new AuthManager();
  const cookies = process.env.NOTEBOOKLM_COOKIES || auth.getSavedCookies();
  client = new NotebookLMClient(cookies);
} catch (error) {
  console.error(chalk.yellow("Warning: No session data found. Please run 'notebooklm-mcp-auth' to log in."));
  // Initialize with empty to avoid immediate crash, tools will fail with AuthError
  client = new NotebookLMClient("");
}

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "notebook_list",
        description: "List all notebooks",
        inputSchema: { type: "object", properties: {} },
      },
      {
        name: "notebook_create",
        description: "Create a new notebook",
        inputSchema: {
          type: "object",
          properties: {
            title: { type: "string" },
          },
          required: ["title"],
        },
      },
      {
        name: "notebook_delete",
        description: "Delete a notebook",
        inputSchema: {
          type: "object",
          properties: {
            notebook_id: { type: "string" },
          },
          required: ["notebook_id"],
        },
      },
      {
        name: "notebook_rename",
        description: "Rename a notebook",
        inputSchema: {
          type: "object",
          properties: {
            notebook_id: { type: "string" },
            title: { type: "string" },
          },
          required: ["notebook_id", "title"],
        },
      },
      {
        name: "notebook_add_url",
        description: "Add a URL as a source",
        inputSchema: {
          type: "object",
          properties: {
            notebook_id: { type: "string" },
            url: { type: "string" },
          },
          required: ["notebook_id", "url"],
        },
      },
      {
        name: "notebook_add_text",
        description: "Add text as a source",
        inputSchema: {
          type: "object",
          properties: {
            notebook_id: { type: "string" },
            title: { type: "string" },
            content: { type: "string" },
          },
          required: ["notebook_id", "title", "content"],
        },
      },
      {
        name: "notebook_query",
        description: "Ask a question about the notebook",
        inputSchema: {
          type: "object",
          properties: {
            notebook_id: { type: "string" },
            query: { type: "string" },
            conversation_id: { type: "string" },
          },
          required: ["notebook_id", "query"],
        },
      },
      {
        name: "research_start",
        description: "Start a research task (web or drive)",
        inputSchema: {
          type: "object",
          properties: {
            notebook_id: { type: "string" },
            query: { type: "string" },
            source: { type: "string", enum: ["web", "drive"], default: "web" },
            mode: { type: "string", enum: ["fast", "deep"], default: "fast" },
          },
          required: ["notebook_id", "query"],
        },
      },
      {
        name: "research_poll",
        description: "Poll for research status and results",
        inputSchema: {
          type: "object",
          properties: {
            notebook_id: { type: "string" },
          },
          required: ["notebook_id"],
        },
      },
      {
        name: "research_import",
        description: "Import research sources into a notebook as permanent sources",
        inputSchema: {
          type: "object",
          properties: {
            notebook_id: { type: "string" },
            task_id: { type: "string", description: "The research task ID" },
            sources: { type: "array", items: { type: "object" }, description: "Sources to import (from research_poll)" },
          },
          required: ["notebook_id", "task_id", "sources"],
        },
      },
      {
        name: "mind_map_generate",
        description: "Generate a Mind Map JSON from notebook sources",
        inputSchema: {
          type: "object",
          properties: {
            source_ids: { type: "array", items: { type: "string" } },
          },
          required: ["source_ids"],
        },
      },
      {
        name: "mind_map_save",
        description: "Save a generated Mind Map to a notebook",
        inputSchema: {
          type: "object",
          properties: {
            notebook_id: { type: "string" },
            mind_map_json: { type: "string" },
            source_ids: { type: "array", items: { type: "string" } },
            title: { type: "string", default: "Mind Map" },
          },
          required: ["notebook_id", "mind_map_json", "source_ids"],
        },
      },
      {
        name: "mind_map_list",
        description: "List all Mind Maps in a notebook",
        inputSchema: {
          type: "object",
          properties: {
            notebook_id: { type: "string" },
          },
          required: ["notebook_id"],
        },
      },
      {
        name: "mind_map_delete",
        description: "Delete a Mind Map from a notebook",
        inputSchema: {
          type: "object",
          properties: {
            notebook_id: { type: "string" },
            mind_map_id: { type: "string" },
          },
          required: ["notebook_id", "mind_map_id"],
        },
      },
      {
        name: "notebook_add_local_file",
        description: "Add a local PDF or text/markdown file as a source",
        inputSchema: {
          type: "object",
          properties: {
            notebook_id: { type: "string" },
            path: { type: "string", description: "Absolute path to the file" },
          },
          required: ["notebook_id", "path"],
        },
      },
      {
        name: "notebook_add_drive",
        description: "Add a Google Drive file (Docs, Slides, etc.) to a notebook",
        inputSchema: {
          type: "object",
          properties: {
            notebook_id: { type: "string" },
            file_id: { type: "string", description: "Google Drive File ID" },
          },
          required: ["notebook_id", "file_id"],
        },
      },
      {
        name: "source_delete",
        description: "Delete a source from a notebook",
        inputSchema: {
          type: "object",
          properties: {
            notebook_id: { type: "string" },
            source_id: { type: "string" },
          },
          required: ["notebook_id", "source_id"],
        },
      },
      {
        name: "source_sync",
        description: "Sync a Google Drive source to get the latest content",
        inputSchema: {
          type: "object",
          properties: {
            notebook_id: { type: "string" },
            source_id: { type: "string" },
          },
          required: ["notebook_id", "source_id"],
        },
      },
      {
        name: "audio_overview_create",
        description: "Generate an Audio Overview (podcast) for the notebook",
        inputSchema: {
          type: "object",
          properties: {
            notebook_id: { type: "string" },
            source_ids: { type: "array", items: { type: "string" }, description: "Sources to include (empty for all)" },
            language: { type: "string", default: "en" },
          },
          required: ["notebook_id"],
        },
      },
      {
        name: "studio_poll",
        description: "Check status of studio artifacts (Audio/Video)",
        inputSchema: {
          type: "object",
          properties: {
            notebook_id: { type: "string" },
          },
          required: ["notebook_id"],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "notebook_list":
        const notebooks = await client.listNotebooks();
        return { content: [{ type: "text", text: JSON.stringify(notebooks, null, 2) }] };
      
      case "notebook_create":
        const newId = await client.createNotebook(args?.title as string);
        return { content: [{ type: "text", text: `Created notebook with ID: ${newId}` }] };

      case "notebook_delete":
        await client.deleteNotebook(args?.notebook_id as string);
        return { content: [{ type: "text", text: `Deleted notebook ${args?.notebook_id}` }] };

      case "notebook_rename":
        await client.renameNotebook(args?.notebook_id as string, args?.title as string);
        return { content: [{ type: "text", text: `Renamed notebook to ${args?.title}` }] };

      case "notebook_add_url":
        const sourceIdUrl = await client.addUrlSource(args?.notebook_id as string, args?.url as string);
        return { content: [{ type: "text", text: `Added source with ID: ${sourceIdUrl}` }] };

      case "notebook_add_text":
        const sourceIdText = await client.addTextSource(args?.notebook_id as string, args?.title as string, args?.content as string);
        return { content: [{ type: "text", text: `Added text source with ID: ${sourceIdText}` }] };

      case "notebook_query":
        const queryResult = await client.query(
          args?.notebook_id as string,
          args?.query as string,
          undefined,
          args?.conversation_id as string
        );
        return { 
          content: [
            { type: "text", text: queryResult.answer },
            { type: "text", text: `\n\n(Conversation ID: ${queryResult.conversation_id})` }
          ] 
        };

      case "research_start":
        const taskInfo = await client.startResearch(
          args?.notebook_id as string,
          args?.query as string,
          (args?.source as 'web' | 'drive') || 'web',
          (args?.mode as 'fast' | 'deep') || 'fast'
        );
        return { content: [{ type: "text", text: `Started research task: ${JSON.stringify(taskInfo)}` }] };

      case "research_poll":
        const researchResult = await client.pollResearch(args?.notebook_id as string);
        return { content: [{ type: "text", text: JSON.stringify(researchResult, null, 2) }] };

      case "research_import":
        const imported = await client.importResearchSources(
          args?.notebook_id as string,
          args?.task_id as string,
          args?.sources as any[]
        );
        return { content: [{ type: "text", text: `Imported ${imported.length} sources: ${JSON.stringify(imported)}` }] };

      case "mind_map_generate":
        const mmData = await client.generateMindMap(args?.source_ids as string[]);
        return { content: [{ type: "text", text: JSON.stringify(mmData, null, 2) }] };

      case "mind_map_save":
        const savedMm = await client.saveMindMap(
          args?.notebook_id as string,
          args?.mind_map_json as string,
          args?.source_ids as string[],
          args?.title as string
        );
        return { content: [{ type: "text", text: `Mind Map saved: ${JSON.stringify(savedMm)}` }] };

      case "mind_map_list":
        const maps = await client.listMindMaps(args?.notebook_id as string);
        return { content: [{ type: "text", text: JSON.stringify(maps, null, 2) }] };

      case "mind_map_delete":
        await client.deleteMindMap(args?.notebook_id as string, args?.mind_map_id as string);
        return { content: [{ type: "text", text: "Mind Map deleted." }] };

      case "notebook_add_local_file":
        const fileSourceId = await client.uploadLocalFile(args?.notebook_id as string, args?.path as string);
        return { content: [{ type: "text", text: `Successfully uploaded and added file. Source ID: ${fileSourceId}` }] };

      case "notebook_add_drive":
        const driveId = await client.addDriveSource(args?.notebook_id as string, args?.file_id as string);
        return { content: [{ type: "text", text: `Successfully added Drive source. ID: ${driveId}` }] };

      case "source_delete":
        await client.deleteSource(args?.notebook_id as string, args?.source_id as string);
        return { content: [{ type: "text", text: `Source ${args?.source_id} deleted successfully.` }] };

      case "source_sync":
        await client.syncDriveSource(args?.notebook_id as string, args?.source_id as string);
        return { content: [{ type: "text", text: `Sync triggered for source ${args?.source_id}.` }] };

      case "audio_overview_create":
        const audioInfo = await client.createAudioOverview(
          args?.notebook_id as string,
          (args?.source_ids as string[]) || [],
          (args?.language as string) || 'en'
        );
        return { content: [{ type: "text", text: `Audio Overview generation started: ${JSON.stringify(audioInfo)}` }] };

      case "studio_poll":
        const studioStatus = await client.pollStudioStatus(args?.notebook_id as string);
        return { content: [{ type: "text", text: JSON.stringify(studioStatus, null, 2) }] };

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error: any) {
    return {
      content: [{ type: "text", text: `Error: ${error.message}` }],
      isError: true,
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("NotebookLM MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
