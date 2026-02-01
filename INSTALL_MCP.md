# NotebookLM MCP: Universal Setup Guide (Windows, macOS, Linux)

This guide provides a single, unified method to install and configure the NotebookLM MCP server on any operating system.

## 🚀 One-Step Setup

The easiest way to set this up is using the provided Python script.

### 1. Run the script
Open your terminal in the root of this repository and run:

```bash
# On Windows
python setup_mcp.py

# On macOS / Linux
python3 setup_mcp.py
```

---

## 🛠️ Manual Installation (Cross-Platform)

If you prefer to do it manually, follow these universal steps:

### 1. Install the Server
```bash
# Windows
python -m pip install --user -U notebooklm-mcp-server

# macOS / Linux
python3 -m pip install --user -U notebooklm-mcp-server
```

### 2. Authenticate (Critical)
You MUST authenticate before the server will work. A browser window will open for you to log in to your Google Account.
```bash
# Windows
notebooklm-mcp-auth

# macOS / Linux
# You might need to add ~/.local/bin to your PATH
notebooklm-mcp-auth
```

### 3. Add to MCP Client Configuration
Locate your configuration file and add this entry:

```json
{
  "mcpServers": {
    "notebooklm": {
      "type": "stdio",
      "command": "PATH_TO_EXECUTABLE",
      "args": []
    }
  }
}
```

**Where is the configuration file?**
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Linux**: `~/.config/Claude/claude_desktop_config.json`

---

## 🤖 Activation in Popular Agents

### 1. Claude Desktop
Claude Desktop uses a JSON configuration file.
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`

Add the entry to `mcpServers`:
```json
{
  "mcpServers": {
    "notebooklm": {
      "type": "stdio",
      "command": "PATH_TO_NOTEBOOKLM_MCP",
      "args": []
    }
  }
}
```

### 2. Cursor
You can add MCP servers directly in the Cursor UI:
1. Open **Cursor Settings** (Cmd + Shift + J or Ctrl + Shift + J).
2. Go to **Features** > **MCP Servers**.
3. Click **+ Add New MCP Server**.
4. Set **Name** to `notebooklm`.
5. Set **Type** to `command`.
6. Set **Command** to the full path provided by the `setup_mcp.py` script.
7. Click **Add**.

### 3. Windsurf
Managed via UI or config file:
- **UI**: Click the MCP icon in the bottom sidebar.
- **Config**: `~/.codeium/windsurf/mcp_config.json` (macOS/Linux).

### 4. Cline (VS Code Extension)
1. Open **Cline Settings** in VS Code.
2. Go to **MCP Servers**.
3. Click **Add**.
4. Set **Name** to `notebooklm`.
5. Set **Command** to the executable path.
6. Click **Save**.

### 5. Antigravity
The configuration is handled via a central `mcp.json` file.
- **Path**: `%APPDATA%\Code\User\mcp.json` (Windows)

Add to the `servers` object:
```json
"notebooklm": {
  "type": "stdio",
  "command": "PATH_TO_EXE",
  "args": []
}
```

### 6. Gemini CLI
Gemini CLI can be configured to use MCP tools by running this command in your terminal:
```bash
codex mcp add notebooklm -- "C:\Users\sirlo\AppData\Roaming\Python\Python311\Scripts\notebooklm-mcp.exe"
```
*(Make sure the path is correct for your system)*

### 7. Visual Studio
Visual Studio support is primarily through extensions.
1. Install an **MCP Client** extension from the Visual Studio Marketplace.
2. In the extension settings, add a new server with the command path provided by `setup_mcp.py`.

---

## ❓ FAQ & Troubleshooting

### Command not found?
If `notebooklm-mcp` or `notebooklm-mcp-auth` are not found after installation, you need to add your Python Scripts folder to your system's PATH.
- **Windows**: Typically `%APPDATA%\Python\Python3xx\Scripts`
- **Linux/macOS**: Typically `~/.local/bin` or the `bin` folder in your Python environment.

### Multiple Python Versions?
Always use the version of Python where you installed the package. If using a virtual environment (venv), the path to the executable will be inside the `bin` (or `Scripts`) folder of that environment.

### Google Login issues?
The authentication tool uses a headless-capable Chrome profile. If login fails, try running the command again and ensure no other instances of the auth Chrome window are open.
