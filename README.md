# NotebookLM MCP Server Setup 🚀

This repository provides a universal, cross-platform solution to install and configure the **NotebookLM MCP Server** on Windows, macOS, and Linux.

With this server, your AI assistant (Claude Desktop, Cursor, VS Code, etc.) can directly interact with your [NotebookLM](https://notebooklm.google.com/) notebooks.

## ✨ Features

- **Universal Installer**: A single Python script that works on all OSs.
- **Automated Configuration**: Detects your environment and generates the necessary JSON snippet.
- **Authentication Guide**: Step-by-step instructions to link your Google account.
- **Full Toolset**: Access to 32+ tools for notebook management, source uploading, and querying.

## 🛠️ Quick Start (The Easiest Way)

1. **Clone this repository**:
   ```bash
   git clone https://github.com/YOUR_USERNAME/notebooklmmcp.git
   cd notebooklmmcp
   ```

2. **Run the universal installer**:
   - **Windows**: `python setup_mcp.py`
   - **macOS / Linux**: `python3 setup_mcp.py`

3. **Follow the instructions**: The script will install the server and show you exactly what JSON code to add to your MCP configuration file.

4. **Authenticate**: Run `notebooklm-mcp-auth` in your terminal and log in via the browser window that appears.

## 📖 Detailed Instructions

For a more in-depth guide, including manual installation and troubleshooting, see [INSTALL_MCP.md](./INSTALL_MCP.md).

## 🧰 Examples of Available Tools

Once configured, your AI assistant will be able to:

- `list_notebooks`: See all your existing NotebookLM notebooks.
- `create_notebook`: Create a new notebook with a title and optional sources.
- `add_source_from_url`: Add a website or online document as a source.
- `get_notebook`: Retrieve the content and summary of a specific notebook.
- `query_notebook`: Ask questions directly to your notebook's sources.

---

## 📄 License

This project is open-source and available for use in any MCP-compatible environment.
