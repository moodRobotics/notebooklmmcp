# Project Roadmap: notebook-mcp-server

The mission of `notebook-mcp-server` is to provide the most robust, Node.js-native bridge to Google NotebookLM, enabling seamless integration with any MCP-compatible environment.

## 🟢 Phase 1: Foundation & Stability (Q1 2026)
*Goal: Solidify the core RPC communication and basic toolset.*
- [x] Reverse-engineer core `batchexecute` RPC protocol.
- [x] Port essential tools: `notebook_list`, `notebook_create`, `notebook_delete`.
- [x] Implement initial Playwright-based authentication.
- [ ] Add comprehensive error handling for token expiration.
- [ ] Implement robust retry logic for network timeouts.
- [ ] Unit testing for RPC payload builders and parsers.

## 🟡 Phase 2: Enhanced Source Management
*Goal: Expand the types of data that can be ingested.*
- [ ] Support for **YouTube URL** ingestion with transcript extraction.
- [ ] Support for **Local File** uploads (Direct PDF/Markdown parsing).
- [ ] Batch source addition (uploading multiple files in one command).
- [ ] Source sync status monitoring (polling for processing completion).
- [ ] Source deletion and renaming tools.

## 🟠 Phase 3: Advanced Interaction & Memory
*Goal: Improve the AI's ability to reason over data.*
- [ ] **Streaming Responses**: Enable real-time text streaming for `notebook_query`.
- [ ] **Context Management**: Auto-trimming conversation history for very long chats.
- [ ] **Research Mode Integration**: Full implementation of "Deep Research" with status polling.
- [ ] **Mind Map Generation**: Expose the NotebookLM mind map creation as a tool.

## 🔴 Phase 4: Developer & User Experience
*Goal: Make the server easier to deploy and manage.*
- [ ] **NPM Global Release**: Publish `notebook-mcp-server` to npmjs.com.
- [ ] **Interactive CLI**: Improve `notebook-mcp-auth` with better terminal progress bars and status checks.
- [ ] **Multi-Account Support**: Allow switching between different browser profiles/cookies.
- [ ] **Docker Support**: Containerized version of the server for headless environments.

## 🚀 Phase 5: Future Horizons
*Goal: Explore broader integrations.*
- [ ] Plugin system for custom post-processing of AI answers.
- [ ] Integration with other "BoQ" services (Google Docs/Keep) if APIs available.
- [ ] Web-based Dashboard for managing saved cookies and server status.

---
*Note: This roadmap is subject to change based on updates to Google's internal APIs.*
