<p align="center">
  <img src="./notebooklm_mcp_logo.png" width="200" alt="Notebook-mcp-server Logo">
</p>

<h1 align="center">NotebookLM MCP Server</h1>

<p align="center">
  <b>Let your AI agents chat directly with Google NotebookLM for zero-hallucination answers.</b>
</p>

<p align="center">
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript"></a>
  <a href="https://modelcontextprotocol.io"><img src="https://img.shields.io/badge/MCP-Model%20Context%20Protocol-orange?style=for-the-badge" alt="MCP"></a>
  <a href="https://www.npmjs.com/package/notebooklm-mcp-server"><img src="https://img.shields.io/badge/NPM-CB3837?style=for-the-badge&logo=npm&logoColor=white" alt="NPM"></a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Windows-0078D4?style=for-the-badge&logo=windows&logoColor=white" alt="Windows">
  <img src="https://img.shields.io/badge/macOS-000000?style=for-the-badge&logo=apple&logoColor=white" alt="macOS">
  <img src="https://img.shields.io/badge/Linux-FCC624?style=for-the-badge&logo=linux&logoColor=black" alt="Linux">
</p>

<p align="center">
  <a href="https://anthropic.com"><img src="https://img.shields.io/badge/Claude%20Code-Skill-blueviolet?style=for-the-badge" alt="Claude Code"></a>
  <a href="https://geminicli.com/"><img src="https://img.shields.io/badge/Gemini%20CLI-Skill-blueviolet?style=for-the-badge" alt="Gemini CLI"></a>
  <img src="https://img.shields.io/badge/Cursor-000000?style=for-the-badge&logo=cursor&logoColor=white" alt="Cursor">
  <img src="https://img.shields.io/badge/Windsurf-00AEEF?style=for-the-badge" alt="Windsurf">
  <img src="https://img.shields.io/badge/Cline-FF5733?style=for-the-badge" alt="Cline">
</p>

<p align="center">
  <a href="#installation">Installation</a> • 
  <a href="#authentication">Authentication</a> • 
  <a href="#quick-start-claude-desktop">Quick Start</a> • 
  <a href="#claude-code-skill">Claude Code</a> • 
  <a href="#documentation">Documentation</a> •
  <a href="#development">Development</a>
</p>

## The Solution

The **NotebookLM MCP Server** brings the power of Google's NotebookLM directly into your AI-augmented workflow. Built natively in **TypeScript** using the Model Context Protocol, it allows agents to read, search, and manage your notebooks as if they were local files.

---

## 🚀 Installation

### 1. Global Installation (Recommended)

You can install the server directly from NPM:

```bash
npm install -g notebooklm-mcp-server
npx playwright install chromium
```

> [!NOTE]
> **Auto-update**: The server automatically checks for new versions at startup. If an update exists, it will install itself and ask you to restart to ensure you always have the latest Google fixes.

### 2. Direct usage with NPX (Zero-Config)

If you don't want to install it globally, you can run it directly:

```bash
npx notebooklm-mcp-server auth   # To log in
npx notebooklm-mcp-server start  # To run the server
```

---

## 🔑 Authentication

Before using the server, you must link it to your Google Account. This version uses a secure, persistent browser session:

1. Run the authentication command:
   ```bash
   npx notebooklm-mcp-server auth
   ```
2. A browser window will open. Log in with your Google account.
3. Close the browser once you see your notebooks. Your session is now securely saved locally.

> [!TIP]
> **Session Expired?** If your agent receives authentication errors, simply ask it to run the command `npx notebooklm-mcp-server refresh_auth`. It will automatically open the browser for you to renew the session without leaving your chat.

---

## ⚡ Quick Start

### 🤖 Claude Desktop

Add the following to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "notebooklm": {
      "command": "npx",
      "args": ["-y", "notebooklm-mcp-server", "start"]
    }
  }
}
```

### 💻 Visual Studio Code

Since VS Code does not support MCP natively yet, you must use an extension:

#### Option A: Using [Cline](https://marketplace.visualstudio.com/items?itemName=saoudrizwan.claude-dev) (Recommended)

1. Open **Cline Settings** in VS Code.
2. Scroll to the **MCP Servers** section.
3. Click **Add New MCP Server**.
4. Use the following configuration:
   - **Name**: `notebooklm`
   - **Command**: `npx -y notebooklm-mcp-server start`

#### Option B: Using [MCP Client](https://marketplace.visualstudio.com/items?itemName=stefan-mcp.mcp-client)

1. Install the extension from the Marketplace.
2. Open your VS Code `settings.json`.
3. Add the server under `mcp.servers`:
   ```json
   "mcp.servers": {
     "notebooklm": {
       "command": "npx",
       "args": ["-y", "notebooklm-mcp-server", "start"]
     }
   }
   ```

### 🌌 Antigravity

Antigravity supports MCP natively. You can add the server by editing your global configuration file:

1. **Locate your `mcp.json`**:
   - **Windows**: `%APPDATA%\antigravity\mcp.json`
   - **macOS**: `~/Library/Application Support/antigravity/mcp.json`
   - **Linux**: `~/.config/antigravity/mcp.json`

2. **Add the server** to the `mcpServers` object:

```json
{
  "mcpServers": {
    "notebooklm": {
      "command": "npx",
      "args": ["-y", "notebooklm-mcp-server", "start"]
    }
  }
}
```

3. **Restart Antigravity**: The new tools will appear in your sidebar instantly.

---

### 💎 Gemini CLI

Run the following command in your terminal to add the notebooklm skill:

```bash
gemini mcp add notebooklm --scope user -- npx -y notebooklm-mcp-server start
```

---

## 🤖 Claude Code Skill

Add it instantly to Claude Code:

```bash
claude skill add notebooklm -- "npx -y notebooklm-mcp-server start"
```

---

## 📖 Documentation

The following tools are available through this MCP server:

### 📒 Notebook Management
| Tool               | Description                                           |
| :----------------- | :---------------------------------------------------- |
| `notebook_list`    | Lists all notebooks in your account.                  |
| `notebook_create`  | Creates a new notebook with a title.                  |
| `notebook_rename`  | Renames an existing notebook.                         |
| `notebook_delete`  | Deletes a notebook (Warning: Destructive).            |

### 🖇️ Source Management
| Tool                     | Description                                            |
| :----------------------- | :----------------------------------------------------- |
| `notebook_add_url`        | Adds a website or YouTube video as a source.           |
| `notebook_add_text`       | Adds custom text content as a source.                  |
| `notebook_add_local_file` | Uploads a local PDF, Markdown or Text file.            |
| `notebook_add_drive`      | Adds a file from Google Drive (Docs, Slides, etc).     |
| `source_delete`           | Removes a source from a notebook.                      |
| `source_sync`             | Syncs a Drive source to get the latest version.        |

### 🔍 Research & Query
| Tool               | Description                                           |
| :----------------- | :---------------------------------------------------- |
| `notebook_query`   | Asks a grounded question to a specific notebook.      |
| `research_start`   | Starts a web/drive research task.                     |
| `research_poll`    | Polls for research status and results.                |
| `research_import`  | Imports research results as permanent sources.        |

### 🎨 Studio & Generation
| Tool                    | Description                                           |
| :---------------------- | :---------------------------------------------------- |
| `audio_overview_create` | Generates an Audio Overview (podcast).                |
| `studio_poll`           | Checks status of generated audio/video artifacts.     |
| `mind_map_generate`     | Generates a Mind Map JSON from sources.               |

### ⚙️ System
| Tool           | Description                                                        |
| :------------- | :----------------------------------------------------------------- |
| `refresh_auth` | **Interactive**: Opens a browser to renew your Google session. Use this if tools start failing. |

---

## 🛠️ Development

To contribute or build from source:

```bash
git clone https://github.com/moodRobotics/notebook-mcp-server.git
npm install
npm run build
```

## 📄 License

MIT License. Developed with ❤️ by [moodRobotics](https://github.com/moodRobotics).
