import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { NotebookLMClient } from "./client.js";
import { AuthManager } from "./auth.js";
import chalk from "chalk";

const VERSION = "3.0.4";

const server = new Server(
  {
    name: "notebooklm-mcp-server",
    version: VERSION,
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

let client: NotebookLMClient;
const authManager = new AuthManager();

/**
 * Read cookies from disk (auth.json). Used as cookie provider for the client
 * so it can automatically reload cookies when authentication expires.
 */
function loadCookiesFromDisk(): string {
  return process.env.NOTEBOOKLM_COOKIES || authManager.getSavedCookies();
}

// Initialize client from saved auth or environment
try {
  const cookies = loadCookiesFromDisk();
  client = new NotebookLMClient(cookies);
  client.setCookieProvider(loadCookiesFromDisk);
} catch (error) {
  console.error(chalk.yellow("Warning: No session data found. Please run 'notebooklm-mcp-server auth' to log in."));
  client = new NotebookLMClient("");
  client.setCookieProvider(loadCookiesFromDisk);
}

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      // ===================== Notebook Operations =====================
      {
        name: "notebook_list",
        description: "List all notebooks with their sources and metadata",
        inputSchema: { type: "object", properties: {} },
      },
      {
        name: "notebook_create",
        description: "Create a new notebook",
        inputSchema: {
          type: "object",
          properties: {
            title: { type: "string", description: "Title for the new notebook" },
          },
          required: ["title"],
        },
      },
      {
        name: "notebook_delete",
        description: "Delete a notebook permanently. IRREVERSIBLE.",
        inputSchema: {
          type: "object",
          properties: {
            notebook_id: { type: "string" },
            confirm: { type: "boolean", description: "Must be true to confirm deletion" },
          },
          required: ["notebook_id", "confirm"],
        },
      },
      {
        name: "notebook_rename",
        description: "Rename a notebook",
        inputSchema: {
          type: "object",
          properties: {
            notebook_id: { type: "string" },
            title: { type: "string", description: "New title" },
          },
          required: ["notebook_id", "title"],
        },
      },

      // ===================== Source Operations =====================
      {
        name: "notebook_add_url",
        description: "Add a URL (website or YouTube) as a source to a notebook",
        inputSchema: {
          type: "object",
          properties: {
            notebook_id: { type: "string" },
            url: { type: "string", description: "URL to add (website or YouTube)" },
          },
          required: ["notebook_id", "url"],
        },
      },
      {
        name: "notebook_add_text",
        description: "Add pasted text as a source to a notebook",
        inputSchema: {
          type: "object",
          properties: {
            notebook_id: { type: "string" },
            title: { type: "string", description: "Title for the text source" },
            content: { type: "string", description: "The text content to add" },
          },
          required: ["notebook_id", "title", "content"],
        },
      },
      {
        name: "notebook_add_drive",
        description: "Add a Google Drive document as a source",
        inputSchema: {
          type: "object",
          properties: {
            notebook_id: { type: "string" },
            document_id: { type: "string", description: "Google Drive document ID" },
            title: { type: "string", description: "Display title for the source" },
            doc_type: {
              type: "string",
              enum: ["doc", "slides", "sheets", "pdf"],
              description: "Type of Drive document",
            },
          },
          required: ["notebook_id", "document_id", "title"],
        },
      },
      {
        name: "notebook_add_local_file",
        description: "Add a local PDF or text/markdown file as a source",
        inputSchema: {
          type: "object",
          properties: {
            notebook_id: { type: "string" },
            path: { type: "string", description: "Absolute path to the file (.pdf, .txt, .md)" },
          },
          required: ["notebook_id", "path"],
        },
      },
      {
        name: "source_delete",
        description: "Delete a source permanently. IRREVERSIBLE.",
        inputSchema: {
          type: "object",
          properties: {
            source_id: { type: "string", description: "Source ID to delete" },
            confirm: { type: "boolean", description: "Must be true to confirm deletion" },
          },
          required: ["source_id", "confirm"],
        },
      },
      {
        name: "source_sync",
        description: "Sync a Google Drive source to get the latest content",
        inputSchema: {
          type: "object",
          properties: {
            source_id: { type: "string", description: "Source ID to sync" },
          },
          required: ["source_id"],
        },
      },

      // ===================== Query =====================
      {
        name: "notebook_query",
        description: "Ask AI about EXISTING sources in a notebook. NOT for finding new sources.",
        inputSchema: {
          type: "object",
          properties: {
            notebook_id: { type: "string" },
            query: { type: "string", description: "Question to ask about the notebook sources" },
            source_ids: {
              type: "array",
              items: { type: "string" },
              description: "Specific source IDs to query (omit for all)",
            },
            conversation_id: { type: "string", description: "For follow-up questions in same conversation" },
          },
          required: ["notebook_id", "query"],
        },
      },

      // ===================== Chat Configuration =====================
      {
        name: "chat_configure",
        description: "Configure notebook chat settings (goal, response length)",
        inputSchema: {
          type: "object",
          properties: {
            notebook_id: { type: "string" },
            goal: {
              type: "string",
              enum: ["default", "learning_guide", "custom"],
              description: "Chat goal mode",
            },
            custom_prompt: { type: "string", description: "Required when goal=custom (max 10000 chars)" },
            response_length: {
              type: "string",
              enum: ["default", "longer", "shorter"],
              description: "Response length preference",
            },
          },
          required: ["notebook_id"],
        },
      },

      // ===================== Research =====================
      {
        name: "research_start",
        description: "Start web or Drive research to find NEW sources. Workflow: research_start → research_poll → research_import",
        inputSchema: {
          type: "object",
          properties: {
            notebook_id: { type: "string" },
            query: { type: "string", description: "What to search for" },
            source: {
              type: "string",
              enum: ["web", "drive"],
              description: "Where to search",
            },
            mode: {
              type: "string",
              enum: ["fast", "deep"],
              description: "fast (~30s, ~10 sources) or deep (~5min, ~40 sources, web only)",
            },
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
        description: "Import discovered research sources into a notebook",
        inputSchema: {
          type: "object",
          properties: {
            notebook_id: { type: "string" },
            task_id: { type: "string", description: "Research task ID from research_poll" },
            sources: {
              type: "array",
              items: { type: "object" },
              description: "Sources array from research_poll results",
            },
          },
          required: ["notebook_id", "task_id", "sources"],
        },
      },

      // ===================== Studio (Audio/Video/Report/etc.) =====================
      {
        name: "audio_overview_create",
        description: "Generate an Audio Overview (podcast) for the notebook",
        inputSchema: {
          type: "object",
          properties: {
            notebook_id: { type: "string" },
            source_ids: {
              type: "array",
              items: { type: "string" },
              description: "Sources to include (empty for all)",
            },
            language: { type: "string", description: "Language code (en, es, fr, etc.)" },
            focus_prompt: { type: "string", description: "Custom instructions for the audio" },
          },
          required: ["notebook_id"],
        },
      },
      {
        name: "video_overview_create",
        description: "Generate a Video Overview for the notebook",
        inputSchema: {
          type: "object",
          properties: {
            notebook_id: { type: "string" },
            source_ids: {
              type: "array",
              items: { type: "string" },
              description: "Sources to include (empty for all)",
            },
            language: { type: "string", description: "Language code (en, es, fr, etc.)" },
            focus_prompt: { type: "string", description: "Custom instructions for the video" },
          },
          required: ["notebook_id"],
        },
      },
      {
        name: "report_create",
        description: "Generate a written report from notebook sources",
        inputSchema: {
          type: "object",
          properties: {
            notebook_id: { type: "string" },
            source_ids: { type: "array", items: { type: "string" } },
            language: { type: "string", description: "Language code" },
            focus_prompt: { type: "string", description: "Focus/instructions for the report" },
          },
          required: ["notebook_id"],
        },
      },
      {
        name: "flashcards_create",
        description: "Generate flashcards from notebook sources",
        inputSchema: {
          type: "object",
          properties: {
            notebook_id: { type: "string" },
            source_ids: { type: "array", items: { type: "string" } },
            language: { type: "string", description: "Language code" },
            focus_prompt: { type: "string", description: "Focus/instructions" },
          },
          required: ["notebook_id"],
        },
      },
      {
        name: "infographic_create",
        description: "Generate an infographic from notebook sources",
        inputSchema: {
          type: "object",
          properties: {
            notebook_id: { type: "string" },
            source_ids: { type: "array", items: { type: "string" } },
            language: { type: "string", description: "Language code" },
            focus_prompt: { type: "string", description: "Focus/instructions" },
          },
          required: ["notebook_id"],
        },
      },
      {
        name: "slide_deck_create",
        description: "Generate a slide deck from notebook sources",
        inputSchema: {
          type: "object",
          properties: {
            notebook_id: { type: "string" },
            source_ids: { type: "array", items: { type: "string" } },
            language: { type: "string", description: "Language code" },
            focus_prompt: { type: "string", description: "Focus/instructions" },
          },
          required: ["notebook_id"],
        },
      },
      {
        name: "data_table_create",
        description: "Generate a data table from notebook sources",
        inputSchema: {
          type: "object",
          properties: {
            notebook_id: { type: "string" },
            source_ids: { type: "array", items: { type: "string" } },
            language: { type: "string", description: "Language code" },
            focus_prompt: { type: "string", description: "Focus/instructions" },
          },
          required: ["notebook_id"],
        },
      },
      {
        name: "studio_poll",
        description: "Check status of studio artifacts (Audio, Video, Report, etc.)",
        inputSchema: {
          type: "object",
          properties: {
            notebook_id: { type: "string" },
          },
          required: ["notebook_id"],
        },
      },
      {
        name: "studio_delete",
        description: "Delete a studio artifact",
        inputSchema: {
          type: "object",
          properties: {
            notebook_id: { type: "string" },
            artifact_id: { type: "string" },
          },
          required: ["notebook_id", "artifact_id"],
        },
      },

      // ===================== Mind Maps =====================
      {
        name: "mind_map_generate",
        description: "Generate a Mind Map JSON from notebook sources",
        inputSchema: {
          type: "object",
          properties: {
            source_ids: { type: "array", items: { type: "string" }, description: "Source IDs to include" },
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
            mind_map_json: { type: "string", description: "The Mind Map JSON from mind_map_generate" },
            source_ids: { type: "array", items: { type: "string" } },
            title: { type: "string", description: "Title for the mind map" },
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

      // ===================== Auth =====================
      {
        name: "refresh_auth",
        description: "Reload authentication cookies from disk. Run 'notebooklm-mcp-server auth' in a terminal first if cookies are expired, then call this tool to pick up the new cookies.",
        inputSchema: { type: "object", properties: {} },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      // ===================== Notebook Operations =====================
      case "notebook_list": {
        const notebooks = await client.listNotebooks();
        if (!notebooks || notebooks.length === 0) {
          return { content: [{ type: "text", text: "No notebooks found. Verify session with 'notebooklm-mcp-auth'." }] };
        }
        const lines = notebooks.map(n => {
          const srcInfo = n.sourceCount > 0
            ? ` | ${n.sourceCount} sources`
            : ' | no sources';
          const shared = n.isShared ? ' [shared]' : '';
          return `- **${n.title}**${shared}${srcInfo}\n  ID: ${n.id}`;
        });
        return { content: [{ type: "text", text: `Found ${notebooks.length} notebooks:\n\n${lines.join('\n')}` }] };
      }

      case "notebook_create": {
        const newId = await client.createNotebook(args?.title as string);
        return { content: [{ type: "text", text: JSON.stringify({ status: "success", notebook_id: newId, title: args?.title }) }] };
      }

      case "notebook_delete": {
        if (!args?.confirm) {
          return { content: [{ type: "text", text: "Deletion requires confirm=true. This action is IRREVERSIBLE." }], isError: true };
        }
        await client.deleteNotebook(args?.notebook_id as string);
        return { content: [{ type: "text", text: "Notebook deleted." }] };
      }

      case "notebook_rename": {
        await client.renameNotebook(args?.notebook_id as string, args?.title as string);
        return { content: [{ type: "text", text: `Notebook renamed to: ${args?.title}` }] };
      }

      // ===================== Source Operations =====================
      case "notebook_add_url": {
        const sourceIdUrl = await client.addUrlSource(args?.notebook_id as string, args?.url as string);
        return { content: [{ type: "text", text: JSON.stringify({ status: "success", source_id: sourceIdUrl }) }] };
      }

      case "notebook_add_text": {
        const sourceIdText = await client.addTextSource(
          args?.notebook_id as string,
          args?.title as string,
          args?.content as string
        );
        return { content: [{ type: "text", text: JSON.stringify({ status: "success", source_id: sourceIdText }) }] };
      }

      case "notebook_add_drive": {
        const docType = (args?.doc_type as string) || 'doc';
        const mimeMap: Record<string, string> = {
          doc: 'application/vnd.google-apps.document',
          slides: 'application/vnd.google-apps.presentation',
          sheets: 'application/vnd.google-apps.spreadsheet',
          pdf: 'application/pdf',
        };
        const mimeType = mimeMap[docType] || mimeMap['doc'];
        const driveId = await client.addDriveSource(
          args?.notebook_id as string,
          args?.document_id as string,
          (args?.title as string) || 'Drive Document',
          mimeType
        );
        return { content: [{ type: "text", text: JSON.stringify({ status: "success", source_id: driveId }) }] };
      }

      case "notebook_add_local_file": {
        const fileSourceId = await client.uploadLocalFile(args?.notebook_id as string, args?.path as string);
        return { content: [{ type: "text", text: JSON.stringify({ status: "success", source_id: fileSourceId }) }] };
      }

      case "source_delete": {
        if (!args?.confirm) {
          return { content: [{ type: "text", text: "Deletion requires confirm=true. This action is IRREVERSIBLE." }], isError: true };
        }
        // Note: deleteSource only needs sourceId (no notebookId), matching Python
        await client.deleteSource(args?.source_id as string);
        return { content: [{ type: "text", text: `Source ${args?.source_id} deleted.` }] };
      }

      case "source_sync": {
        // Note: syncDriveSource only needs sourceId (no notebookId), matching Python
        const syncResult = await client.syncDriveSource(args?.source_id as string);
        return { content: [{ type: "text", text: JSON.stringify({ status: "success", result: syncResult }) }] };
      }

      // ===================== Query =====================
      case "notebook_query": {
        const queryResult = await client.query(
          args?.notebook_id as string,
          args?.query as string,
          args?.source_ids as string[] | undefined,
          args?.conversation_id as string | undefined
        );
        return { content: [{ type: "text", text: JSON.stringify(queryResult, null, 2) }] };
      }

      // ===================== Chat Configuration =====================
      case "chat_configure": {
        await client.configureChatGoal(
          args?.notebook_id as string,
          (args?.goal as any) || 'default',
          args?.custom_prompt as string | undefined,
          (args?.response_length as any) || 'default'
        );
        return { content: [{ type: "text", text: "Chat configuration updated." }] };
      }

      // ===================== Research =====================
      case "research_start": {
        const taskInfo = await client.startResearch(
          args?.notebook_id as string,
          args?.query as string,
          (args?.source as 'web' | 'drive') || 'web',
          (args?.mode as 'fast' | 'deep') || 'fast'
        );
        return { content: [{ type: "text", text: JSON.stringify({ status: "started", task: taskInfo }, null, 2) }] };
      }

      case "research_poll": {
        const researchResult = await client.pollResearch(args?.notebook_id as string);
        return { content: [{ type: "text", text: JSON.stringify(researchResult, null, 2) }] };
      }

      case "research_import": {
        const imported = await client.importResearchSources(
          args?.notebook_id as string,
          args?.task_id as string,
          args?.sources as any[]
        );
        return { content: [{ type: "text", text: JSON.stringify({ status: "success", imported_count: imported.length, sources: imported }, null, 2) }] };
      }

      // ===================== Studio =====================
      case "audio_overview_create": {
        const audioInfo = await client.createAudioOverview(
          args?.notebook_id as string,
          (args?.source_ids as string[]) || [],
          (args?.language as string) || 'en',
          1, // formatCode
          2, // lengthCode
          (args?.focus_prompt as string) || ''
        );
        return { content: [{ type: "text", text: JSON.stringify({ status: "success", artifact: audioInfo }, null, 2) }] };
      }

      case "video_overview_create": {
        const videoInfo = await client.createVideoOverview(
          args?.notebook_id as string,
          (args?.source_ids as string[]) || [],
          (args?.language as string) || 'en',
          1, // formatCode
          1, // styleCode
          (args?.focus_prompt as string) || ''
        );
        return { content: [{ type: "text", text: JSON.stringify({ status: "success", artifact: videoInfo }, null, 2) }] };
      }

      case "report_create": {
        const reportInfo = await client.createReport(
          args?.notebook_id as string,
          (args?.source_ids as string[]) || [],
          (args?.language as string) || 'en',
          (args?.focus_prompt as string) || ''
        );
        return { content: [{ type: "text", text: JSON.stringify({ status: "success", artifact: reportInfo }, null, 2) }] };
      }

      case "flashcards_create": {
        const fcInfo = await client.createFlashcards(
          args?.notebook_id as string,
          (args?.source_ids as string[]) || [],
          (args?.language as string) || 'en',
          (args?.focus_prompt as string) || ''
        );
        return { content: [{ type: "text", text: JSON.stringify({ status: "success", artifact: fcInfo }, null, 2) }] };
      }

      case "infographic_create": {
        const igInfo = await client.createInfographic(
          args?.notebook_id as string,
          (args?.source_ids as string[]) || [],
          (args?.language as string) || 'en',
          1, // orientationCode
          (args?.focus_prompt as string) || ''
        );
        return { content: [{ type: "text", text: JSON.stringify({ status: "success", artifact: igInfo }, null, 2) }] };
      }

      case "slide_deck_create": {
        const sdInfo = await client.createSlideDeck(
          args?.notebook_id as string,
          (args?.source_ids as string[]) || [],
          (args?.language as string) || 'en',
          (args?.focus_prompt as string) || ''
        );
        return { content: [{ type: "text", text: JSON.stringify({ status: "success", artifact: sdInfo }, null, 2) }] };
      }

      case "data_table_create": {
        const dtInfo = await client.createDataTable(
          args?.notebook_id as string,
          (args?.source_ids as string[]) || [],
          (args?.language as string) || 'en',
          (args?.focus_prompt as string) || ''
        );
        return { content: [{ type: "text", text: JSON.stringify({ status: "success", artifact: dtInfo }, null, 2) }] };
      }

      case "studio_poll": {
        const studioStatus = await client.pollStudioStatus(args?.notebook_id as string);
        return { content: [{ type: "text", text: JSON.stringify({ artifacts: studioStatus }, null, 2) }] };
      }

      case "studio_delete": {
        await client.deleteStudioArtifact(args?.notebook_id as string, args?.artifact_id as string);
        return { content: [{ type: "text", text: "Artifact deleted." }] };
      }

      // ===================== Mind Maps =====================
      case "mind_map_generate": {
        const mmData = await client.generateMindMap(args?.source_ids as string[]);
        return { content: [{ type: "text", text: JSON.stringify(mmData, null, 2) }] };
      }

      case "mind_map_save": {
        const savedMm = await client.saveMindMap(
          args?.notebook_id as string,
          args?.mind_map_json as string,
          args?.source_ids as string[],
          (args?.title as string) || 'Mind Map'
        );
        return { content: [{ type: "text", text: JSON.stringify({ status: "success", mind_map: savedMm }, null, 2) }] };
      }

      case "mind_map_list": {
        const maps = await client.listMindMaps(args?.notebook_id as string);
        return { content: [{ type: "text", text: JSON.stringify({ mind_maps: maps }, null, 2) }] };
      }

      case "mind_map_delete": {
        await client.deleteMindMap(args?.notebook_id as string, args?.mind_map_id as string);
        return { content: [{ type: "text", text: "Mind Map deleted." }] };
      }

      // ===================== Auth =====================
      case "refresh_auth": {
        try {
          const newCookies = loadCookiesFromDisk();
          client.updateCookies(newCookies);
          return { content: [{ type: "text", text: "Cookies reloaded from disk. If authentication still fails, run 'notebooklm-mcp-server auth' in a terminal first." }] };
        } catch (e: any) {
          return { 
            content: [{ type: "text", text: `No saved cookies found. Please run 'notebooklm-mcp-server auth' in a terminal first, then call refresh_auth again. Error: ${e.message}` }],
            isError: true,
          };
        }
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error: any) {
    console.error(chalk.red(`Tool error [${name}]:`), error);
    return {
      content: [{ type: "text", text: `Error: ${error.message || String(error)}` }],
      isError: true,
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`NotebookLM MCP Server v${VERSION} running on stdio`);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
