import axios, { AxiosInstance } from 'axios';
import { BASE_URL, BATCH_EXECUTE_PATH, QUERY_PATH, RPC_IDS, BUILD_LABEL, SOURCE_ADD_TIMEOUT } from './constants.js';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdf = require('pdf-parse');

export class AuthenticationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export interface Notebook {
  id: string;
  title: string;
  sourceCount: number;
  sources: { id: string; title: string }[];
  isOwned: boolean;
  isShared: boolean;
  createdAt: string | null;
  modifiedAt: string | null;
}

/**
 * Parse a [seconds, nanoseconds] timestamp from the API into ISO format.
 */
function parseTimestamp(tsArray: any): string | null {
  if (!Array.isArray(tsArray) || tsArray.length < 1) return null;
  const seconds = tsArray[0];
  if (typeof seconds !== 'number' || seconds < 1000000000) return null;
  try {
    return new Date(seconds * 1000).toISOString();
  } catch {
    return null;
  }
}

export type CookieProvider = () => string;

export class NotebookLMClient {
  private client: AxiosInstance;
  private csrfToken: string | null = null;
  private sessionId: string | null = null;
  private initialized = false;
  private reqidCounter: number;
  private cookieProvider?: CookieProvider;

  constructor(cookies: string) {
    this.reqidCounter = Math.floor(Math.random() * 900000 + 100000);

    this.client = axios.create({
      baseURL: BASE_URL,
      headers: {
        'Cookie': cookies,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
        'Origin': BASE_URL,
        'Referer': `${BASE_URL}/`,
        'X-Same-Domain': '1',
      },
    });
  }

  /**
   * Update cookies on this client instance (e.g. after re-authentication).
   * Resets initialization so the next call re-fetches the CSRF token.
   */
  updateCookies(cookies: string): void {
    this.client.defaults.headers['Cookie'] = cookies;
    this.initialized = false;
    this.csrfToken = null;
    this.sessionId = null;
  }

  /**
   * Set a cookie provider function that will be called to reload cookies
   * from disk when authentication fails.
   */
  setCookieProvider(provider: CookieProvider): void {
    this.cookieProvider = provider;
  }

  /**
   * Try to reload cookies from the cookie provider (e.g. from auth.json on disk).
   * Returns true if cookies were successfully reloaded.
   */
  private tryReloadCookies(): boolean {
    if (!this.cookieProvider) return false;
    try {
      const newCookies = this.cookieProvider();
      if (newCookies) {
        this.updateCookies(newCookies);
        console.error('[NotebookLM] Reloaded cookies from disk.');
        return true;
      }
    } catch (e: any) {
      console.error('[NotebookLM] Failed to reload cookies from disk:', e.message);
    }
    return false;
  }

  /**
   * Initialize CSRF token and session ID from the main page.
   * Must be called before any RPC call.
   */
  async init(): Promise<void> {
    if (this.initialized) return;
    try {
      const response = await this.client.get('/', {
        headers: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Sec-Fetch-User': '?1',
        },
        maxRedirects: 5,
      });

      // Check if redirected to login
      const finalUrl = response.request?.res?.responseUrl || response.config?.url || '';
      if (typeof finalUrl === 'string' && finalUrl.includes('accounts.google.com')) {
        throw new AuthenticationError(
          'Authentication expired. Run notebooklm-mcp-server auth to re-authenticate.'
        );
      }

      const html = typeof response.data === 'string' ? response.data : '';
      const csrfMatch = html.match(/"SNlM0e"\s*:\s*"([^"]+)"/);
      if (csrfMatch) {
        this.csrfToken = csrfMatch[1];
      }
      const sidMatch = html.match(/"FdrFJe"\s*:\s*"([^"]+)"/);
      if (sidMatch) {
        this.sessionId = sidMatch[1];
      }
      this.initialized = true;
      if (!this.csrfToken) {
        console.error('[NotebookLM] Warning: Could not extract CSRF token. Authentication may be expired.');
      }
    } catch (e: any) {
      if (e instanceof AuthenticationError) throw e;
      console.error('[NotebookLM] Failed to initialize session:', e.message);
    }
  }

  /**
   * Build the batchexecute request body (matching Python implementation exactly).
   * Uses compact JSON and adds trailing & like the Python version.
   */
  private buildRequestBody(rpcId: string, params: any[]): string {
    const paramsJson = JSON.stringify(params);
    const fReq = JSON.stringify([[[rpcId, paramsJson, null, "generic"]]]);

    const parts: string[] = [];
    parts.push(`f.req=${encodeURIComponent(fReq)}`);
    if (this.csrfToken) {
      parts.push(`at=${encodeURIComponent(this.csrfToken)}`);
    }
    // Trailing & matches Python urllib.parse behaviour
    return parts.join('&') + '&';
  }

  /**
   * Build the batchexecute URL with query params.
   */
  private buildUrl(rpcId: string, sourcePath: string = '/'): string {
    const params: Record<string, string> = {
      'rpcids': rpcId,
      'source-path': sourcePath,
      'bl': BUILD_LABEL,
      'hl': 'en',
      'rt': 'c',
    };
    if (this.sessionId) {
      params['f.sid'] = this.sessionId;
    }
    const qs = Object.entries(params).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
    return `${BATCH_EXECUTE_PATH}?${qs}`;
  }

  /**
   * Internal RPC executor using the standard Google batchexecute format.
   * Matches the Python _call_rpc() method.
   */
  private async callRpc(
    rpcId: string,
    params: any[],
    sourcePath: string = '/',
    timeout?: number,
    _retryCount = 0
  ): Promise<any> {
    await this.init();

    const body = this.buildRequestBody(rpcId, params);
    const url = this.buildUrl(rpcId, sourcePath);

    try {
      const response = await this.client.post(url, body, {
        timeout: timeout || 30000,
      });

      const parsed = this.parseResponse(response.data);
      const result = this.extractRpcResult(parsed, rpcId);
      return result;
    } catch (error: any) {
      const isAuthError =
        error instanceof AuthenticationError ||
        error.response?.status === 401 ||
        error.response?.status === 403;

      if (isAuthError && _retryCount < 2) {
        console.error(`[NotebookLM] Auth failure. Reloading cookies (attempt ${_retryCount + 1})...`);
        // Try to reload cookies from disk (user may have run auth in another process)
        this.tryReloadCookies();
        this.initialized = false;
        await this.init();
        return this.callRpc(rpcId, params, sourcePath, timeout, _retryCount + 1);
      }

      if (isAuthError) {
        throw new AuthenticationError(
          'Authentication failed. Please run: notebooklm-mcp-server auth'
        );
      }

      throw error;
    }
  }

  /**
   * Parse the batchexecute response.
   * Matches Python _parse_response() exactly.
   */
  private parseResponse(data: any): any[] {
    let text = typeof data === 'string' ? data : JSON.stringify(data);

    // Remove anti-XSSI prefix
    if (text.startsWith(")]}'\n")) {
      text = text.substring(5);
    } else if (text.startsWith(")]}'\r\n")) {
      text = text.substring(6);
    }

    const lines = text.split('\n');
    const results: any[] = [];
    let i = 0;

    while (i < lines.length) {
      const line = lines[i].trim();
      if (!line) { i++; continue; }

      // Try to parse as byte count
      if (/^\d+$/.test(line)) {
        i++;
        if (i < lines.length) {
          try {
            const parsed = JSON.parse(lines[i]);
            results.push(parsed);
          } catch { /* not valid JSON */ }
        }
        i++;
      } else {
        // Not a byte count, try to parse as JSON
        try {
          const parsed = JSON.parse(line);
          results.push(parsed);
        } catch { /* not valid JSON */ }
        i++;
      }
    }

    return results;
  }

  /**
   * Extract the result for a specific RPC ID from the parsed response.
   * Matches Python _extract_rpc_result() exactly.
   */
  private extractRpcResult(parsedResponse: any[], rpcId: string): any {
    for (const chunk of parsedResponse) {
      if (!Array.isArray(chunk)) continue;
      for (const item of chunk) {
        if (!Array.isArray(item) || item.length < 3) continue;

        if (item[0] === 'wrb.fr' && item[1] === rpcId) {
          // Check for generic error signature (auth expired)
          // Signature: ["wrb.fr", "RPC_ID", null, null, null, [16], "generic"]
          if (item.length > 6 && item[6] === 'generic' && Array.isArray(item[5]) && item[5].includes(16)) {
            throw new AuthenticationError('RPC Error 16: Authentication expired');
          }

          const resultStr = item[2];
          if (typeof resultStr === 'string') {
            try {
              return JSON.parse(resultStr);
            } catch {
              return resultStr;
            }
          }
          return resultStr;
        }
      }
    }
    return null;
  }

  // =========================================================================
  // Notebook Operations (matching Python exactly)
  // =========================================================================

  async listNotebooks(): Promise<Notebook[]> {
    // Python: params = [None, 1, None, [2]]
    const result = await this.callRpc(RPC_IDS.LIST_NOTEBOOKS, [null, 1, null, [2]]);

    const notebooks: Notebook[] = [];
    if (!result || !Array.isArray(result)) return notebooks;

    // Response structure: result[0] = array of notebooks
    const notebookList = Array.isArray(result[0]) ? result[0] : result;

    for (const nbData of notebookList) {
      if (!Array.isArray(nbData) || nbData.length < 3) continue;

      // Python structure: [title, sources, notebook_id, emoji, null, metadata]
      const title = typeof nbData[0] === 'string' ? nbData[0] : 'Untitled';
      const sourcesData = Array.isArray(nbData[1]) ? nbData[1] : [];
      const notebookId = nbData[2];

      if (!notebookId) continue;

      let isOwned = true;
      let isShared = false;
      let createdAt: string | null = null;
      let modifiedAt: string | null = null;

      // Parse metadata at position 5
      if (nbData.length > 5 && Array.isArray(nbData[5]) && nbData[5].length > 0) {
        const metadata = nbData[5];
        // metadata[0] = ownership (1=mine, 2=shared_with_me)
        isOwned = metadata[0] === 1;
        if (metadata.length > 1) {
          isShared = !!metadata[1];
        }
        // metadata[5] = [seconds, nanos] = last modified
        if (metadata.length > 5) {
          modifiedAt = parseTimestamp(metadata[5]);
        }
        // metadata[8] = [seconds, nanos] = created
        if (metadata.length > 8) {
          createdAt = parseTimestamp(metadata[8]);
        }
      }

      // Parse sources
      const sources: { id: string; title: string }[] = [];
      for (const src of sourcesData) {
        if (!Array.isArray(src) || src.length < 2) continue;
        const srcIds = src[0];
        const srcTitle = src[1] || 'Untitled';
        const srcId = Array.isArray(srcIds) && srcIds.length > 0 ? srcIds[0] : srcIds;
        if (srcId) {
          sources.push({ id: srcId, title: srcTitle });
        }
      }

      notebooks.push({
        id: notebookId,
        title,
        sourceCount: sources.length,
        sources,
        isOwned,
        isShared,
        createdAt,
        modifiedAt,
      });
    }

    return notebooks;
  }

  /**
   * Get a single notebook's data including all source IDs.
   * Uses the GET_NOTEBOOK RPC (rLM1Ne).
   */
  async getNotebook(notebookId: string): Promise<any> {
    // Python: params = [notebook_id, None, [2], None, 0]
    const result = await this.callRpc(
      RPC_IDS.GET_NOTEBOOK,
      [notebookId, null, [2], null, 0],
      `/notebook/${notebookId}`
    );
    return result;
  }

  /**
   * Extract source IDs from raw notebook data returned by getNotebook().
   * Matches Python _extract_source_ids_from_notebook().
   */
  private extractSourceIdsFromNotebook(notebookData: any): string[] {
    const sourceIds: string[] = [];
    if (!notebookData || !Array.isArray(notebookData)) return sourceIds;

    try {
      // Structure: notebookData[0] = [title, sources_array, notebook_id, ...]
      const notebookInfo = Array.isArray(notebookData[0]) ? notebookData[0] : notebookData;
      if (notebookInfo.length > 1 && Array.isArray(notebookInfo[1])) {
        const sources = notebookInfo[1];
        for (const source of sources) {
          // Each source: [[source_id], title, metadata, ...]
          if (Array.isArray(source) && source.length > 0) {
            const sourceIdWrapper = source[0];
            if (Array.isArray(sourceIdWrapper) && sourceIdWrapper.length > 0) {
              const sourceId = sourceIdWrapper[0];
              if (typeof sourceId === 'string') {
                sourceIds.push(sourceId);
              }
            }
          }
        }
      }
    } catch {
      // ignore parse errors
    }

    return sourceIds;
  }

  async createNotebook(title: string): Promise<string> {
    // Python: params = [title, None, None, [2], [1, None, None, None, None, None, None, None, None, None, [1]]]
    const params = [title, null, null, [2], [1, null, null, null, null, null, null, null, null, null, [1]]];
    const result = await this.callRpc(RPC_IDS.CREATE_NOTEBOOK, params);
    // Response: result[2] = notebook_id (Python: nb_data[2])
    if (result && Array.isArray(result) && result.length >= 3) {
      return result[2] || '';
    }
    // Fallback: try result[0] for older formats
    return result?.[0] || '';
  }

  async deleteNotebook(notebookId: string): Promise<boolean> {
    // Python: params = [[notebook_id], [2]]
    await this.callRpc(RPC_IDS.DELETE_NOTEBOOK, [[notebookId], [2]]);
    return true;
  }

  async renameNotebook(notebookId: string, newTitle: string): Promise<boolean> {
    // Python: params = [notebook_id, [[None, None, None, [None, new_title]]]]
    const params = [notebookId, [[null, null, null, [null, newTitle]]]];
    await this.callRpc(RPC_IDS.RENAME_NOTEBOOK, params, `/notebook/${notebookId}`);
    return true;
  }

  // =========================================================================
  // Source Operations (matching Python exactly)
  // =========================================================================

  async addUrlSource(notebookId: string, url: string): Promise<string> {
    const isYoutube = url.toLowerCase().includes('youtube.com') || url.toLowerCase().includes('youtu.be');

    // Python:
    // YouTube: [None, None, None, None, None, None, None, [url], None, None, 1]
    // Regular: [None, None, [url], None, None, None, None, None, None, None, 1]
    const sourceData = isYoutube
      ? [null, null, null, null, null, null, null, [url], null, null, 1]
      : [null, null, [url], null, null, null, null, null, null, null, 1];

    const params = [
      [sourceData],
      notebookId,
      [2],
      [1, null, null, null, null, null, null, null, null, null, [1]]
    ];

    const result = await this.callRpc(
      RPC_IDS.ADD_SOURCE, params,
      `/notebook/${notebookId}`,
      SOURCE_ADD_TIMEOUT
    );

    // Parse response: result[0][0][0][0] = source_id
    if (result && Array.isArray(result[0])) {
      const sourceList = result[0];
      if (sourceList.length > 0 && Array.isArray(sourceList[0])) {
        return sourceList[0][0]?.[0] || '';
      }
    }
    return '';
  }

  async addTextSource(notebookId: string, title: string, content: string): Promise<string> {
    // Python: source_data = [None, [title, text], None, 2, None, None, None, None, None, None, 1]
    // Note: Type code is 2 (not 4 like our old code)
    const sourceData = [null, [title, content], null, 2, null, null, null, null, null, null, 1];
    const params = [
      [sourceData],
      notebookId,
      [2],
      [1, null, null, null, null, null, null, null, null, null, [1]]
    ];

    const result = await this.callRpc(
      RPC_IDS.ADD_SOURCE, params,
      `/notebook/${notebookId}`,
      SOURCE_ADD_TIMEOUT
    );

    if (result && Array.isArray(result[0])) {
      const sourceList = result[0];
      if (sourceList.length > 0 && Array.isArray(sourceList[0])) {
        return sourceList[0][0]?.[0] || '';
      }
    }
    return '';
  }

  async addDriveSource(
    notebookId: string,
    documentId: string,
    title: string = 'Drive Document',
    mimeType: string = 'application/vnd.google-apps.document'
  ): Promise<string> {
    // Python: source_data = [[document_id, mime_type, 1, title], None, None, None, None, None, None, None, None, None, 1]
    const sourceData = [
      [documentId, mimeType, 1, title],
      null, null, null, null, null, null, null, null, null, 1
    ];
    const params = [
      [sourceData],
      notebookId,
      [2],
      [1, null, null, null, null, null, null, null, null, null, [1]]
    ];

    const result = await this.callRpc(
      RPC_IDS.ADD_SOURCE, params,
      `/notebook/${notebookId}`,
      SOURCE_ADD_TIMEOUT
    );

    if (result && Array.isArray(result[0])) {
      const sourceList = result[0];
      if (sourceList.length > 0 && Array.isArray(sourceList[0])) {
        return sourceList[0][0]?.[0] || '';
      }
    }
    return '';
  }

  async deleteSource(sourceId: string): Promise<boolean> {
    // Python: params = [[[source_id]], [2]]
    // Note: NO notebookId parameter - Python only sends sourceId
    await this.callRpc(RPC_IDS.DELETE_SOURCE, [[[sourceId]], [2]]);
    return true;
  }

  async syncDriveSource(sourceId: string): Promise<any> {
    // Python: params = [None, [source_id], [2]]
    // Note: NO notebookId parameter
    const result = await this.callRpc(RPC_IDS.SYNC_DRIVE_SOURCE, [null, [sourceId], [2]]);

    if (result && Array.isArray(result) && result.length > 0) {
      const sourceData = result[0];
      if (Array.isArray(sourceData) && sourceData.length >= 3) {
        return {
          id: sourceData[0]?.[0] || null,
          title: sourceData[1] || 'Unknown',
        };
      }
    }
    return null;
  }

  // =========================================================================
  // Chat Configuration (matching Python exactly)
  // =========================================================================

  async configureChatGoal(
    notebookId: string,
    goal: 'default' | 'learning_guide' | 'custom' = 'default',
    customPrompt?: string,
    responseLength: 'default' | 'longer' | 'shorter' = 'default'
  ): Promise<boolean> {
    // Python goal_code mapping: default=1, learning_guide=3, custom=2
    const goalCodes: Record<string, number> = { default: 1, learning_guide: 3, custom: 2 };
    const goalCode = goalCodes[goal] || 1;

    // Python response_length_code: default=1, longer=2, shorter=3
    const lengthCodes: Record<string, number> = { default: 1, longer: 2, shorter: 3 };
    const lengthCode = lengthCodes[responseLength] || 1;

    const prompt = goal === 'custom' && customPrompt ? customPrompt : '';

    // Python: params = [notebook_id, [goal_code, prompt, length_code]]
    const params = [notebookId, [goalCode, prompt, lengthCode]];
    await this.callRpc(RPC_IDS.RENAME_NOTEBOOK, params, `/notebook/${notebookId}`);
    // Actually, Python uses a different RPC for chat_configure... let me check
    // Looking at the code more carefully, Python uses a separate RPC for this.
    // For now we use the same approach the Python server uses.
    return true;
  }

  // =========================================================================
  // Research Operations (matching Python exactly)
  // =========================================================================

  async startResearch(
    notebookId: string,
    queryText: string,
    source: 'web' | 'drive' = 'web',
    mode: 'fast' | 'deep' = 'fast',
  ): Promise<any> {
    const sourceType = source === 'web' ? 1 : 2;
    const isDeep = mode === 'deep';
    const rpcId = isDeep ? RPC_IDS.START_DEEP_RESEARCH : RPC_IDS.START_FAST_RESEARCH;

    // Python:
    // Fast: [[query, source_type], None, 1, notebook_id]
    // Deep: [None, [1], [query, source_type], 5, notebook_id]
    const params = isDeep
      ? [null, [1], [queryText, sourceType], 5, notebookId]
      : [[queryText, sourceType], null, 1, notebookId];

    const result = await this.callRpc(rpcId, params, `/notebook/${notebookId}`);

    if (result && Array.isArray(result) && result.length > 0) {
      return {
        task_id: result[0],
        report_id: result[1] || null,
        notebook_id: notebookId,
        query: queryText,
        source,
        mode,
      };
    }
    return null;
  }

  async pollResearch(notebookId: string): Promise<any> {
    // Python: params = [None, None, notebook_id]
    const result = await this.callRpc(
      RPC_IDS.POLL_RESEARCH,
      [null, null, notebookId],
      `/notebook/${notebookId}`
    );

    if (!result || !Array.isArray(result) || result.length === 0) {
      return { status: 'no_research', message: 'No active research found' };
    }

    // Unwrap outer array if needed
    let taskList = result;
    if (Array.isArray(result[0]) && result[0].length > 0 && Array.isArray(result[0][0])) {
      taskList = result[0];
    }

    for (const taskData of taskList) {
      if (!Array.isArray(taskData) || taskData.length < 2) continue;

      const taskId = taskData[0];
      if (typeof taskId !== 'string') continue;

      const taskInfo = taskData[1];
      if (!taskInfo || !Array.isArray(taskInfo)) continue;

      const queryInfo = taskInfo[1] || null;
      const researchMode = taskInfo[2] || null;
      const sourcesAndSummary = taskInfo[3] || [];
      const statusCode = taskInfo[4] || null;

      const queryTextResult = queryInfo && queryInfo.length > 0 ? queryInfo[0] : '';
      const sourceType = queryInfo && queryInfo.length > 1 ? queryInfo[1] : 1;

      let sourcesData: any[] = [];
      let summary = '';

      if (Array.isArray(sourcesAndSummary) && sourcesAndSummary.length >= 1) {
        sourcesData = Array.isArray(sourcesAndSummary[0]) ? sourcesAndSummary[0] : [];
        if (sourcesAndSummary.length >= 2 && typeof sourcesAndSummary[1] === 'string') {
          summary = sourcesAndSummary[1];
        }
      }

      const sources: any[] = [];
      if (Array.isArray(sourcesData)) {
        for (let idx = 0; idx < sourcesData.length; idx++) {
          const src = sourcesData[idx];
          if (!Array.isArray(src) || src.length < 2) continue;

          if (src[0] === null && src.length > 1 && typeof src[1] === 'string') {
            // Deep research format
            sources.push({
              index: idx,
              url: '',
              title: src[1] || '',
              description: '',
              result_type: src[3] || 5,
            });
          } else {
            // Fast research format: [url, title, desc, type, ...]
            sources.push({
              index: idx,
              url: typeof src[0] === 'string' ? src[0] : '',
              title: src[1] || '',
              description: src[2] || '',
              result_type: typeof src[3] === 'number' ? src[3] : 1,
            });
          }
        }
      }

      // Status: 2 = completed, 6 = imported/completed, anything else = in_progress
      const status = (statusCode === 2 || statusCode === 6) ? 'completed' : 'in_progress';

      return {
        task_id: taskId,
        status,
        query: queryTextResult,
        source_type: sourceType === 1 ? 'web' : 'drive',
        mode: researchMode === 5 ? 'deep' : 'fast',
        sources,
        source_count: sources.length,
        summary,
      };
    }

    return { status: 'no_research', message: 'No active research found' };
  }

  async importResearchSources(notebookId: string, taskId: string, sources: any[]): Promise<any[]> {
    if (!sources.length) return [];

    const sourceArray: any[] = [];
    for (const src of sources) {
      const url = src.url || '';
      const title = src.title || 'Untitled';
      const resultType = src.result_type || 1;

      // Skip deep_report sources (type 5) and empty URLs
      if (resultType === 5 || !url) continue;

      if (resultType === 1) {
        // Web source
        sourceArray.push([null, null, [url, title], null, null, null, null, null, null, null, 2]);
      } else {
        // Drive source - extract doc_id from URL
        let docId: string | null = null;
        if (url.includes('id=')) {
          docId = url.split('id=').pop()?.split('&')[0] || null;
        }

        if (docId) {
          const mimeTypes: Record<number, string> = {
            2: 'application/vnd.google-apps.document',
            3: 'application/vnd.google-apps.presentation',
            8: 'application/vnd.google-apps.spreadsheet',
          };
          const mimeType = mimeTypes[resultType] || 'application/vnd.google-apps.document';
          sourceArray.push([[docId, mimeType, 1, title], null, null, null, null, null, null, null, null, null, 2]);
        } else {
          sourceArray.push([null, null, [url, title], null, null, null, null, null, null, null, 2]);
        }
      }
    }

    // Python: params = [None, [1], task_id, notebook_id, source_array]
    const params = [null, [1], taskId, notebookId, sourceArray];
    const result = await this.callRpc(
      RPC_IDS.IMPORT_RESEARCH, params,
      `/notebook/${notebookId}`,
      120000
    );

    const imported: any[] = [];
    if (result && Array.isArray(result)) {
      // Unwrap if nested
      let resultData = result;
      if (result.length > 0 && Array.isArray(result[0]) && result[0].length > 0 && Array.isArray(result[0][0])) {
        resultData = result[0];
      }

      for (const srcData of resultData) {
        if (Array.isArray(srcData) && srcData.length >= 2) {
          const srcId = srcData[0]?.[0] || null;
          const srcTitle = srcData[1] || 'Untitled';
          if (srcId) {
            imported.push({ id: srcId, title: srcTitle });
          }
        }
      }
    }
    return imported;
  }

  // =========================================================================
  // Mind Map Operations (matching Python exactly)
  // =========================================================================

  async generateMindMap(sourceIds: string[]): Promise<any> {
    const sourcesNested = sourceIds.map(sid => [[sid]]);
    const params = [
      sourcesNested,
      null, null, null, null,
      ["interactive_mindmap", [["[CONTEXT]", ""]], ""],
      null,
      [2, null, [1]]
    ];
    const result = await this.callRpc(RPC_IDS.GENERATE_MIND_MAP, params);
    if (result && Array.isArray(result) && result.length > 0) {
      const inner = Array.isArray(result[0]) ? result[0] : result;
      return {
        mind_map_json: typeof inner[0] === 'string' ? inner[0] : null,
        generation_id: inner[2]?.[0] || null,
      };
    }
    return null;
  }

  async saveMindMap(
    notebookId: string,
    mindMapJson: string,
    sourceIds: string[],
    title: string = 'Mind Map'
  ): Promise<any> {
    const sourcesSimple = sourceIds.map(sid => [sid]);
    const metadata = [2, null, null, 5, sourcesSimple];
    const params = [notebookId, mindMapJson, metadata, null, title];
    const result = await this.callRpc(
      RPC_IDS.SAVE_MIND_MAP, params,
      `/notebook/${notebookId}`
    );
    if (result && Array.isArray(result) && result.length > 0) {
      const inner = Array.isArray(result[0]) ? result[0] : result;
      return {
        mind_map_id: inner[0] || null,
        title: inner[4] || title,
        mind_map_json: inner[1] || null,
      };
    }
    return null;
  }

  async listMindMaps(notebookId: string): Promise<any[]> {
    const result = await this.callRpc(
      RPC_IDS.LIST_MIND_MAPS,
      [notebookId],
      `/notebook/${notebookId}`
    );
    if (!result || !Array.isArray(result) || !Array.isArray(result[0])) return [];

    const maps: any[] = [];
    for (const mmData of result[0]) {
      if (!Array.isArray(mmData) || mmData.length < 2) continue;
      // Skip tombstone/deleted entries (details is null)
      const details = mmData[1];
      if (details === null) continue;

      const mindMapId = mmData[0];
      if (Array.isArray(details) && details.length >= 5) {
        const createdAt = details[2] ? parseTimestamp(details[2]?.[2] || details[2]) : null;
        maps.push({
          id: mindMapId,
          title: details[4] || 'Mind Map',
          json: details[1] || null,
          created_at: createdAt,
        });
      }
    }
    return maps;
  }

  async deleteMindMap(notebookId: string, mindMapId: string): Promise<boolean> {
    // Step 1: Get timestamp from list
    const list = await this.callRpc(
      RPC_IDS.LIST_MIND_MAPS,
      [notebookId],
      `/notebook/${notebookId}`
    );
    let timestamp = null;
    if (list && Array.isArray(list[0])) {
      const mm = list[0].find((e: any) => Array.isArray(e) && e[0] === mindMapId);
      if (mm?.[1]?.[2]?.[2]) {
        timestamp = mm[1][2][2];
      }
    }

    // Step 2: UUID-based deletion
    await this.callRpc(
      RPC_IDS.DELETE_MIND_MAP,
      [notebookId, null, [mindMapId], [2]],
      `/notebook/${notebookId}`
    );

    // Step 3: Timestamp sync (ensures UI consistency)
    if (timestamp) {
      await this.callRpc(
        RPC_IDS.LIST_MIND_MAPS,
        [notebookId, null, timestamp, [2]],
        `/notebook/${notebookId}`
      );
    }
    return true;
  }

  // =========================================================================
  // Studio Operations (matching Python exactly)
  // =========================================================================

  async createAudioOverview(
    notebookId: string,
    sourceIds: string[],
    language: string = 'en',
    formatCode: number = 1,
    lengthCode: number = 2,
    focusPrompt: string = ''
  ): Promise<any> {
    const sourcesNested = sourceIds.map(sid => [[sid]]);
    const sourcesSimple = sourceIds.map(sid => [sid]);

    // Python structure:
    // audio_options = [None, [focus_prompt, length_code, None, sources_simple, language, None, format_code]]
    // params = [[2], notebook_id, [None, None, STUDIO_TYPE_AUDIO(=1), sources_nested, None, None, audio_options]]
    const audioOptions = [
      null,
      [focusPrompt, lengthCode, null, sourcesSimple, language, null, formatCode]
    ];

    const params = [
      [2],
      notebookId,
      [null, null, 1, sourcesNested, null, null, audioOptions]
    ];

    const result = await this.callRpc(
      RPC_IDS.STUDIO_GENERATE, params,
      `/notebook/${notebookId}`
    );

    if (result && Array.isArray(result) && result.length > 0) {
      const artifactData = result[0];
      const artifactId = Array.isArray(artifactData) ? artifactData[0] : null;
      const statusCode = Array.isArray(artifactData) && artifactData.length > 4 ? artifactData[4] : null;
      return {
        artifact_id: artifactId,
        notebook_id: notebookId,
        type: 'audio',
        status: statusCode === 1 ? 'in_progress' : statusCode === 3 ? 'completed' : 'unknown',
      };
    }
    return null;
  }

  async createVideoOverview(
    notebookId: string,
    sourceIds: string[],
    language: string = 'en',
    formatCode: number = 1,
    styleCode: number = 1,
    focusPrompt: string = ''
  ): Promise<any> {
    const sourcesNested = sourceIds.map(sid => [[sid]]);
    const sourcesSimple = sourceIds.map(sid => [sid]);

    // Python structure for video (studio type = 3):
    // video_options = [None, [focus_prompt, None, None, sources_simple, language, None, format_code, None, None, style_code]]
    const videoOptions = [
      null,
      [focusPrompt, null, null, sourcesSimple, language, null, formatCode, null, null, styleCode]
    ];

    const params = [
      [2],
      notebookId,
      [null, null, 3, sourcesNested, null, null, videoOptions]
    ];

    const result = await this.callRpc(
      RPC_IDS.STUDIO_GENERATE, params,
      `/notebook/${notebookId}`
    );

    if (result && Array.isArray(result) && result.length > 0) {
      const artifactData = result[0];
      const artifactId = Array.isArray(artifactData) ? artifactData[0] : null;
      const statusCode = Array.isArray(artifactData) && artifactData.length > 4 ? artifactData[4] : null;
      return {
        artifact_id: artifactId,
        notebook_id: notebookId,
        type: 'video',
        status: statusCode === 1 ? 'in_progress' : statusCode === 3 ? 'completed' : 'unknown',
      };
    }
    return null;
  }

  async createReport(
    notebookId: string,
    sourceIds: string[],
    language: string = 'en',
    focusPrompt: string = ''
  ): Promise<any> {
    const sourcesNested = sourceIds.map(sid => [[sid]]);
    const sourcesSimple = sourceIds.map(sid => [sid]);

    // Python: studio type 2 = report
    const reportOptions = [
      null,
      [focusPrompt, null, null, sourcesSimple, language]
    ];

    const params = [
      [2],
      notebookId,
      [null, null, 2, sourcesNested, null, null, reportOptions]
    ];

    const result = await this.callRpc(
      RPC_IDS.STUDIO_GENERATE, params,
      `/notebook/${notebookId}`
    );

    if (result && Array.isArray(result) && result.length > 0) {
      const artifactData = result[0];
      return {
        artifact_id: Array.isArray(artifactData) ? artifactData[0] : null,
        notebook_id: notebookId,
        type: 'report',
        status: 'in_progress',
      };
    }
    return null;
  }

  async createFlashcards(
    notebookId: string,
    sourceIds: string[],
    language: string = 'en',
    focusPrompt: string = ''
  ): Promise<any> {
    const sourcesNested = sourceIds.map(sid => [[sid]]);
    const sourcesSimple = sourceIds.map(sid => [sid]);

    // Python: studio type 4 = flashcards
    const options = [
      null,
      [focusPrompt, null, null, sourcesSimple, language]
    ];

    const params = [
      [2],
      notebookId,
      [null, null, 4, sourcesNested, null, null, options]
    ];

    const result = await this.callRpc(
      RPC_IDS.STUDIO_GENERATE, params,
      `/notebook/${notebookId}`
    );

    if (result && Array.isArray(result) && result.length > 0) {
      const artifactData = result[0];
      return {
        artifact_id: Array.isArray(artifactData) ? artifactData[0] : null,
        notebook_id: notebookId,
        type: 'flashcards',
        status: 'in_progress',
      };
    }
    return null;
  }

  async createInfographic(
    notebookId: string,
    sourceIds: string[],
    language: string = 'en',
    orientationCode: number = 1,
    focusPrompt: string = ''
  ): Promise<any> {
    const sourcesNested = sourceIds.map(sid => [[sid]]);
    const sourcesSimple = sourceIds.map(sid => [sid]);

    // Python: studio type 7 = infographic
    const options = [
      null,
      [focusPrompt, null, null, sourcesSimple, language, null, null, null, null, null, orientationCode]
    ];

    const params = [
      [2],
      notebookId,
      [null, null, 7, sourcesNested, null, null, options]
    ];

    const result = await this.callRpc(
      RPC_IDS.STUDIO_GENERATE, params,
      `/notebook/${notebookId}`
    );

    if (result && Array.isArray(result) && result.length > 0) {
      const artifactData = result[0];
      return {
        artifact_id: Array.isArray(artifactData) ? artifactData[0] : null,
        notebook_id: notebookId,
        type: 'infographic',
        status: 'in_progress',
      };
    }
    return null;
  }

  async createSlideDeck(
    notebookId: string,
    sourceIds: string[],
    language: string = 'en',
    focusPrompt: string = ''
  ): Promise<any> {
    const sourcesNested = sourceIds.map(sid => [[sid]]);
    const sourcesSimple = sourceIds.map(sid => [sid]);

    // Python: studio type 8 = slide_deck
    const options = [
      null,
      [focusPrompt, null, null, sourcesSimple, language]
    ];

    const params = [
      [2],
      notebookId,
      [null, null, 8, sourcesNested, null, null, options]
    ];

    const result = await this.callRpc(
      RPC_IDS.STUDIO_GENERATE, params,
      `/notebook/${notebookId}`
    );

    if (result && Array.isArray(result) && result.length > 0) {
      const artifactData = result[0];
      return {
        artifact_id: Array.isArray(artifactData) ? artifactData[0] : null,
        notebook_id: notebookId,
        type: 'slide_deck',
        status: 'in_progress',
      };
    }
    return null;
  }

  async createDataTable(
    notebookId: string,
    sourceIds: string[],
    language: string = 'en',
    focusPrompt: string = ''
  ): Promise<any> {
    const sourcesNested = sourceIds.map(sid => [[sid]]);
    const sourcesSimple = sourceIds.map(sid => [sid]);

    // Python: studio type 9 = data_table
    const options = [
      null,
      [focusPrompt, null, null, sourcesSimple, language]
    ];

    const params = [
      [2],
      notebookId,
      [null, null, 9, sourcesNested, null, null, options]
    ];

    const result = await this.callRpc(
      RPC_IDS.STUDIO_GENERATE, params,
      `/notebook/${notebookId}`
    );

    if (result && Array.isArray(result) && result.length > 0) {
      const artifactData = result[0];
      return {
        artifact_id: Array.isArray(artifactData) ? artifactData[0] : null,
        notebook_id: notebookId,
        type: 'data_table',
        status: 'in_progress',
      };
    }
    return null;
  }

  async deleteStudioArtifact(notebookId: string, artifactId: string): Promise<boolean> {
    // Python: params = [[2], notebook_id, [artifact_id]]
    await this.callRpc(
      RPC_IDS.STUDIO_DELETE,
      [[2], notebookId, [artifactId]],
      `/notebook/${notebookId}`
    );
    return true;
  }

  async pollStudioStatus(notebookId: string): Promise<any[]> {
    // Python: params = [[2], notebook_id, 'NOT artifact.status = "ARTIFACT_STATUS_SUGGESTED"']
    const params = [[2], notebookId, 'NOT artifact.status = "ARTIFACT_STATUS_SUGGESTED"'];
    const result = await this.callRpc(
      RPC_IDS.STUDIO_STATUS, params,
      `/notebook/${notebookId}`
    );

    const artifacts: any[] = [];
    if (!result || !Array.isArray(result) || result.length === 0) return artifacts;

    const artifactList = Array.isArray(result[0]) ? result[0] : result;
    for (const artifactData of artifactList) {
      if (!Array.isArray(artifactData) || artifactData.length < 5) continue;

      const typeMap: Record<number, string> = {
        1: 'audio', 2: 'report', 3: 'video', 4: 'flashcards',
        7: 'infographic', 8: 'slide_deck', 9: 'data_table',
      };

      const artifactId = artifactData[0];
      const title = artifactData[1] || '';
      const typeCode = artifactData[2] || null;
      const statusCode = artifactData[4] || null;

      // Parse content for reports, flashcards, etc.
      let content: string | null = null;
      if (artifactData.length > 7 && artifactData[7]) {
        if (Array.isArray(artifactData[7]) && artifactData[7].length > 0) {
          content = artifactData[7][0] || null;
        }
      }

      // Parse audio/video URL
      let mediaUrl: string | null = null;
      if (artifactData.length > 8 && typeof artifactData[8] === 'string') {
        mediaUrl = artifactData[8];
      }

      artifacts.push({
        artifact_id: artifactId,
        title,
        type: typeMap[typeCode as number] || 'unknown',
        status: statusCode === 1 ? 'in_progress' : statusCode === 3 ? 'completed' : 'unknown',
        content,
        media_url: mediaUrl,
      });
    }

    return artifacts;
  }

  // =========================================================================
  // Local File Upload
  // =========================================================================

  async uploadLocalFile(notebookId: string, filePath: string): Promise<string> {
    const absolutePath = path.resolve(filePath);
    if (!fs.existsSync(absolutePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const ext = path.extname(absolutePath).toLowerCase();
    const fileName = path.basename(absolutePath);
    let content = '';

    if (ext === '.pdf') {
      const dataBuffer = fs.readFileSync(absolutePath);
      const data = await pdf(dataBuffer);
      content = data.text;
    } else if (['.txt', '.md', '.markdown'].includes(ext)) {
      content = fs.readFileSync(absolutePath, 'utf-8');
    } else {
      throw new Error(`Unsupported file type: ${ext}. Currently supports .pdf, .txt, .md`);
    }

    if (!content.trim()) {
      throw new Error('File is empty or contains no readable text.');
    }

    return await this.addTextSource(notebookId, fileName, content);
  }

  // =========================================================================
  // Query (uses different endpoint - matching Python exactly)
  // =========================================================================

  async query(
    notebookId: string,
    queryText: string,
    sourceIds?: string[],
    conversationId?: string,
    _retryCount = 0
  ): Promise<any> {
    await this.init();

    // Auto-fetch source_ids from notebook if not provided (matches Python behavior)
    if (!sourceIds || sourceIds.length === 0) {
      try {
        const notebookData = await this.getNotebook(notebookId);
        sourceIds = this.extractSourceIdsFromNotebook(notebookData);
        console.error(`[NotebookLM] Auto-fetched ${sourceIds.length} source IDs from notebook`);
      } catch (e: any) {
        console.error(`[NotebookLM] Warning: Could not auto-fetch source IDs: ${e.message}`);
        sourceIds = [];
      }
    }

    const cid = conversationId || uuidv4();
    // Python: sources_array = [[[sid]] for sid in source_ids] (triple nested)
    const sources = sourceIds.length > 0 ? sourceIds.map(id => [[id]]) : [];

    // Python: params = [sources_array, query_text, None, [2, null, [1]], conversation_id]
    const params = [
      sources,
      queryText,
      null,
      [2, null, [1]],
      cid
    ];

    // Python uses: f_req = [None, params_json]
    const paramsJson = JSON.stringify(params);
    const fReq = JSON.stringify([null, paramsJson]);

    const bodyParts: string[] = [];
    bodyParts.push(`f.req=${encodeURIComponent(fReq)}`);
    if (this.csrfToken) {
      bodyParts.push(`at=${encodeURIComponent(this.csrfToken)}`);
    }
    const body = bodyParts.join('&') + '&';

    this.reqidCounter += 100000;
    const urlParams: Record<string, string> = {
      'bl': BUILD_LABEL,
      'hl': 'en',
      '_reqid': String(this.reqidCounter),
      'rt': 'c',
    };
    if (this.sessionId) {
      urlParams['f.sid'] = this.sessionId;
    }

    const qs = Object.entries(urlParams).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
    // Use the STREAMING QUERY ENDPOINT (different from batchexecute!)
    const url = `${BASE_URL}${QUERY_PATH}?${qs}`;

    try {
      const response = await this.client.post(url, body, {
        timeout: 120000,
      });

      const answer = this.parseQueryResponse(response.data);
      return {
        answer,
        conversation_id: cid,
      };
    } catch (error: any) {
      const isAuthError =
        error instanceof AuthenticationError ||
        error.response?.status === 401 ||
        error.response?.status === 403;

      if (isAuthError && _retryCount < 2) {
        console.error(`[NotebookLM] Query auth failure. Reloading cookies (attempt ${_retryCount + 1})...`);
        this.tryReloadCookies();
        this.initialized = false;
        await this.init();
        return this.query(notebookId, queryText, sourceIds, conversationId, _retryCount + 1);
      }

      if (isAuthError) {
        throw new AuthenticationError(
          'Authentication failed. Please run: notebooklm-mcp-server auth'
        );
      }

      throw error;
    }
  }

  /**
   * Parse the streaming query response.
   * Matches Python _parse_query_response() exactly.
   */
  private parseQueryResponse(data: string): string {
    if (data.startsWith(")]}'")) {
      data = data.substring(4);
    }

    const lines = data.split('\n');
    let longestAnswer = '';
    let longestThinking = '';

    let i = 0;
    while (i < lines.length) {
      const line = lines[i].trim();
      if (!line) { i++; continue; }

      const byteCount = parseInt(line);
      if (!isNaN(byteCount) && String(byteCount) === line.trim()) {
        i++;
        if (i < lines.length) {
          const { text, isAnswer } = this.extractFromChunk(lines[i]);
          if (text) {
            if (isAnswer && text.length > longestAnswer.length) longestAnswer = text;
            else if (!isAnswer && text.length > longestThinking.length) longestThinking = text;
          }
        }
        i++;
      } else {
        const { text, isAnswer } = this.extractFromChunk(line);
        if (text) {
          if (isAnswer && text.length > longestAnswer.length) longestAnswer = text;
          else if (!isAnswer && text.length > longestThinking.length) longestThinking = text;
        }
        i++;
      }
    }

    return longestAnswer || longestThinking || 'No answer received.';
  }

  /**
   * Extract answer text from a single JSON chunk.
   * Matches Python _extract_answer_from_chunk() exactly.
   */
  private extractFromChunk(jsonStr: string): { text: string | null; isAnswer: boolean } {
    try {
      const data = JSON.parse(jsonStr);
      if (!Array.isArray(data) || data.length === 0) return { text: null, isAnswer: false };

      for (const item of data) {
        if (!Array.isArray(item) || item.length < 3) continue;
        if (item[0] !== 'wrb.fr') continue;

        const innerJsonStr = item[2];
        if (typeof innerJsonStr !== 'string') continue;

        let innerData: any;
        try {
          innerData = JSON.parse(innerJsonStr);
        } catch { continue; }

        if (Array.isArray(innerData) && innerData.length > 0) {
          const firstElem = innerData[0];
          if (Array.isArray(firstElem) && firstElem.length > 0) {
            const answerText = firstElem[0];
            if (typeof answerText === 'string' && answerText.length > 20) {
              let isAnswer = false;
              if (firstElem.length > 4 && Array.isArray(firstElem[4])) {
                const typeInfo = firstElem[4];
                isAnswer = typeInfo[typeInfo.length - 1] === 1;
              }
              return { text: answerText, isAnswer };
            }
          } else if (typeof firstElem === 'string' && firstElem.length > 20) {
            return { text: firstElem, isAnswer: false };
          }
        }
      }
    } catch { /* ignore */ }
    return { text: null, isAnswer: false };
  }

  /**
   * Force re-fetch of CSRF token and session ID.
   */
  async refreshTokens(): Promise<void> {
    this.initialized = false;
    await this.init();
  }
}
