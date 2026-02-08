# System Architecture

The `notebook-mcp-server` is designed to be a lightweight, robust bridge between the Model Context Protocol (MCP) and Google NotebookLM's internal RPC system.

## Core Components

### 1. MCP Server Layer (`@modelcontextprotocol/sdk`)
This layer handles the communication with MCP clients (like Claude Desktop). It implements:
- **Tool Discovery**: Exposing functionality like `notebook_create`, `notebook_query`, etc.
- **JSON-RPC interface**: Standardized communication for tool execution.

### 2. NotebookLM API Client (`axios` + `undici`)
Since Google does not provide a public API for NotebookLM, this server performs **reverse-engineered RPC calls**:
- **BatchExecute**: Mimics the `batchexecute` protocol used by Google BoQ services.
- **RPC IDs**: Uses specific 6-character IDs (e.g., `wXbhsf`, `fXbgzd`) to invoke backend methods.
- **Streaming Parser**: Highly optimized parser to handle chunked gRPC-style responses from the query endpoint.

### 3. Authentication & Session Manager
Maintains the bridge to the user's Google account:
- **Cookie Store**: Locally encrypted/secured storage of session cookies (`SID`, `HSID`, `SSID`, etc.).
- **CSRF Protection**: Automatically fetches and refreshes the `at` (CSRF) token required for state-changing requests.
- **Auto-Refresh**: Logic to attempt session recovery before failing.

## Data Flow

1. **Request**: MCP Client sends a tool execution request.
2. **Context**: Server retrieves stored session data from the local vault.
3. **RPC**: Client translates the high-level request into a `batchexecute` payload.
4. **Response**: Server receives the multi-chunk Google response, extracts the payload, and sanitizes it for the LLM.

## Security Considerations

- **Credentials Storage**: Cookies are stored only locally.
- **Transport**: All communication with Google is enforced over HTTPS.
- **Privacy**: The server does not log sensitive payload contents unless DEBUG mode is explicitly enabled.
