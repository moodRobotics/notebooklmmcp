#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { chromium, BrowserContext, Page } from "playwright";
import * as path from "path";
import * as os from "os";
import { Command } from "commander";
import { runAuth } from "./auth.js";

// Validation Schemas
const CreateNotebookSchema = z.object({
  title: z.string().optional(),
});

const ListNotebooksSchema = z.object({});

const GetNotebookSchema = z.object({
  notebookId: z.string(),
});

const QueryNotebookSchema = z.object({
  notebookId: z.string(),
  query: z.string(),
});

const AddSourceUrlSchema = z.object({
  notebookId: z.string(),
  url: z.string().url(),
});

const AddSourceTextSchema = z.object({
  notebookId: z.string(),
  title: z.string(),
  text: z.string(),
});

const RenameNotebookSchema = z.object({
  notebookId: z.string(),
  newTitle: z.string(),
});

const DeleteNotebookSchema = z.object({
  notebookId: z.string(),
});

const AudioOverviewSchema = z.object({
  notebookId: z.string(),
});

class NotebookLMServer {
  private server: Server;
  private browser: BrowserContext | null = null;
  private userDataDir: string;

  constructor() {
    this.userDataDir = path.join(os.homedir(), ".notebooklm-mcp-auth");
    this.server = new Server(
      {
        name: "notebooklm-mcp-server",
        version: "1.0.2",
      },
      {
        capabilities: {
          tools: {},
        },
      },
    );

    this.setupTools();

    // Error handling
    this.server.onerror = (error) => console.error("[MCP Error]", error);
  }

  private async cleanup() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  private async getBrowser(): Promise<BrowserContext> {
    if (!this.browser) {
      this.browser = await chromium.launchPersistentContext(this.userDataDir, {
        headless: true, // Standard for MCP servers
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      });
    }
    return this.browser;
  }

  private async getPage(notebookId?: string): Promise<Page> {
    const context = await this.getBrowser();
    const page = await context.newPage();
    const url = notebookId
      ? `https://notebooklm.google.com/notebook/${notebookId}`
      : "https://notebooklm.google.com/";

    await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
    return page;
  }

  private setupTools() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: "list_notebooks",
          description: "Lists all your Google NotebookLM notebooks",
          inputSchema: { type: "object", properties: {} },
        },
        {
          name: "create_notebook",
          description: "Creates a new empty notebook",
          inputSchema: {
            type: "object",
            properties: {
              title: {
                type: "string",
                description: "Optional title for the new notebook",
              },
            },
          },
        },
        {
          name: "get_notebook",
          description:
            "Retrieves details, sources, and summaries of a notebook",
          inputSchema: {
            type: "object",
            properties: {
              notebookId: { type: "string" },
            },
            required: ["notebookId"],
          },
        },
        {
          name: "query_notebook",
          description: "Asks a grounded question to a specific notebook",
          inputSchema: {
            type: "object",
            properties: {
              notebookId: { type: "string" },
              query: { type: "string" },
            },
            required: ["notebookId", "query"],
          },
        },
        {
          name: "add_source_url",
          description: "Adds a website or YouTube video as a source",
          inputSchema: {
            type: "object",
            properties: {
              notebookId: { type: "string" },
              url: { type: "string", format: "uri" },
            },
            required: ["notebookId", "url"],
          },
        },
        {
          name: "add_source_text",
          description: "Adds pasted text content as a source",
          inputSchema: {
            type: "object",
            properties: {
              notebookId: { type: "string" },
              title: { type: "string" },
              text: { type: "string" },
            },
            required: ["notebookId", "title", "text"],
          },
        },
        {
          name: "generate_audio_overview",
          description:
            "Triggers the generation of an Audio Overview (Deep Dive podcast)",
          inputSchema: {
            type: "object",
            properties: {
              notebookId: { type: "string" },
            },
            required: ["notebookId"],
          },
        },
        {
          name: "rename_notebook",
          description: "Renames a notebook",
          inputSchema: {
            type: "object",
            properties: {
              notebookId: { type: "string" },
              newTitle: { type: "string" },
            },
            required: ["notebookId", "newTitle"],
          },
        },
        {
          name: "delete_notebook",
          description: "Deletes a notebook by its ID (Warning: Destructive)",
          inputSchema: {
            type: "object",
            properties: {
              notebookId: { type: "string" },
            },
            required: ["notebookId"],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case "list_notebooks": {
            const page = await this.getPage();
            await page
              .locator('a[href*="/notebook/"]')
              .first()
              .waitFor({ state: "visible", timeout: 15000 });

            const notebooks = await page.evaluate(() => {
              const cards = Array.from(
                document.querySelectorAll('a[href*="/notebook/"]'),
              );
              return cards
                .map((c) => {
                  const href = (c as HTMLAnchorElement).href;
                  const matches = href.match(/notebook\/([a-zA-Z0-9_-]+)/);
                  const id = matches ? matches[1] : "";
                  const title =
                    c.textContent?.trim().split("\n")[0] || "Untitled";
                  return { id, title };
                })
                .filter((n) => n.id && n.id !== "notebook");
            });

            await page.close();
            return {
              content: [
                { type: "text", text: JSON.stringify(notebooks, null, 2) },
              ],
            };
          }

          case "create_notebook": {
            const page = await this.getPage();
            // Look for the "Create new" button or the plus icon
            const createBtn = page
              .locator('text="Create new", [aria-label*="Create"]')
              .first();
            await createBtn.click();
            await page.waitForURL(/notebook\/[a-zA-Z0-9_-]+/);
            const id =
              page.url().match(/notebook\/([a-zA-Z0-9_-]+)/)?.[1] || "";

            const { title } = CreateNotebookSchema.parse(args);
            if (title) {
              await page.waitForTimeout(2000);
              // Try to find the title element and rename
              const titleElem = page
                .locator('input[aria-label*="title"], [contenteditable="true"]')
                .first();
              await titleElem.click();
              await page.keyboard.press("Control+A");
              await page.keyboard.type(title);
              await page.keyboard.press("Enter");
            }

            await page.close();
            return {
              content: [
                {
                  type: "text",
                  text: `Success: Notebook created with ID: ${id}`,
                },
              ],
            };
          }

          case "query_notebook": {
            const { notebookId, query } = QueryNotebookSchema.parse(args);
            const page = await this.getPage(notebookId);

            const chatInput = page
              .locator(
                'textarea[placeholder*="Ask"], [role="textbox"][aria-label*="chat"]',
              )
              .first();
            await chatInput.waitFor({ state: "visible" });
            await chatInput.fill(query);
            await page.keyboard.press("Enter");

            // Wait for response bubble (Google usually uses specific indicators)
            await page.waitForTimeout(3000);
            await page.waitForSelector(
              '[role="log"], .chat-bubble, .response-content',
              { timeout: 60000 },
            );

            const result = await page.evaluate(() => {
              const bubbles = Array.from(
                document.querySelectorAll(
                  '[role="log"], .chat-bubble, .response-content',
                ),
              );
              const last = bubbles[bubbles.length - 1];
              return last?.textContent?.trim() || "No response received.";
            });

            await page.close();
            return { content: [{ type: "text", text: result }] };
          }

          case "get_notebook": {
            const { notebookId } = GetNotebookSchema.parse(args);
            const page = await this.getPage(notebookId);

            const info = await page.evaluate(() => {
              const title = document.title.replace(" - NotebookLM", "");
              const sources = Array.from(
                document.querySelectorAll(
                  '.source-card-title, [aria-label*="Source"]',
                ),
              )
                .map((s) => s.textContent?.trim())
                .filter(Boolean);
              return { title, sources };
            });

            await page.close();
            return {
              content: [{ type: "text", text: JSON.stringify(info, null, 2) }],
            };
          }

          case "add_source_url": {
            const { notebookId, url } = AddSourceUrlSchema.parse(args);
            const page = await this.getPage(notebookId);

            await page.getByText("Add source", { exact: false }).click();
            await page.getByText("Link", { exact: true }).click();
            await page.locator('input[type="url"]').fill(url);
            await page.getByRole("button", { name: /Add|Insert/i }).click();

            await page.waitForTimeout(5000); // Give it time to start processing
            await page.close();
            return {
              content: [
                {
                  type: "text",
                  text: `Source ${url} added to notebook ${notebookId}.`,
                },
              ],
            };
          }

          case "add_source_text": {
            const { notebookId, title, text } = AddSourceTextSchema.parse(args);
            const page = await this.getPage(notebookId);

            await page.getByText("Add source", { exact: false }).click();
            await page.getByText("Text", { exact: true }).click();
            await page.locator('input[placeholder*="Title"]').fill(title);
            await page.locator("textarea").fill(text);
            await page.getByRole("button", { name: /Add|Insert/i }).click();

            await page.waitForTimeout(3000);
            await page.close();
            return {
              content: [
                { type: "text", text: `Text source "${title}" added.` },
              ],
            };
          }

          case "rename_notebook": {
            const { notebookId, newTitle } = RenameNotebookSchema.parse(args);
            const page = await this.getPage(notebookId);
            const titleElem = page
              .locator('input[aria-label*="title"], [contenteditable="true"]')
              .first();
            await titleElem.click();
            await page.keyboard.press("Control+A");
            await page.keyboard.type(newTitle);
            await page.keyboard.press("Enter");
            await page.waitForTimeout(1000);
            await page.close();
            return {
              content: [
                { type: "text", text: `Notebook renamed to: ${newTitle}` },
              ],
            };
          }

          case "delete_notebook": {
            const { notebookId } = DeleteNotebookSchema.parse(args);
            const page = await this.getPage(); // Go to home to delete from menu
            // Find the notebook menu option (three dots) for this ID
            const menuBtn = page
              .locator(`a[href*="${notebookId}"]`)
              .locator("..")
              .locator('button[aria-label*="Menu"]')
              .first();
            await menuBtn.click();
            await page.getByText("Delete", { exact: false }).click();
            await page.getByRole("button", { name: /Delete/i }).click(); // Confirm dialog

            await page.waitForTimeout(2000);
            await page.close();
            return {
              content: [
                { type: "text", text: `Notebook ${notebookId} deleted.` },
              ],
            };
          }

          case "generate_audio_overview": {
            const { notebookId } = AudioOverviewSchema.parse(args);
            const page = await this.getPage(notebookId);

            await page.getByText("Notebook guide", { exact: false }).click();
            await page.getByText("Audio Overview", { exact: false }).click();
            await page.getByRole("button", { name: /Generate/i }).click();

            await page.close();
            return {
              content: [
                { type: "text", text: "Audio overview generation triggered." },
              ],
            };
          }

          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Tool not found: ${name}`,
            );
        }
      } catch (error: any) {
        console.error(`Error in tool ${name}:`, error);
        return {
          content: [{ type: "text", text: `Error: ${error.message}` }],
          isError: true,
        };
      }
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("NotebookLM MCP Server running on stdio");
  }
}

const program = new Command();
program
  .name("notebooklm-mcp")
  .description("MCP server for Google NotebookLM")
  .version("1.0.2");

program
  .command("start")
  .description("Start the MCP server")
  .action(async () => {
    const server = new NotebookLMServer();
    await server.run();
  });

program
  .command("auth")
  .description("Open browser for authentication")
  .action(async () => {
    await runAuth();
  });

if (process.argv.length <= 2) {
  new NotebookLMServer().run().catch(console.error);
} else {
  program.parse(process.argv);
}
