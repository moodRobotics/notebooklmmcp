import axios, { AxiosInstance } from 'axios';
import { BASE_URL, BATCH_EXECUTE_PATH, RPC_IDS, QUERY_PATH } from './constants.js';
import { v4 as uuidv4 } from 'uuid';
import * as urllib from 'url';
import * as fs from 'fs';
import * as path from 'path';
// @ts-ignore
import pdf from 'pdf-parse/lib/pdf-parse.js';

export class AuthenticationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export interface Notebook {
  id: string;
  title: string;
  lastModified: number;
}

export class NotebookLMClient {
  private client: AxiosInstance;
  private csrfToken: string | null = null;
  private sessionId: string | null = null;

  constructor(cookies: string) {
    this.client = axios.create({
      baseURL: BASE_URL,
      headers: {
        'Cookie': cookies,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      },
    });
  }

  /**
   * Internal RPC executor with retry logic for auth failures.
   */
  private async callRpc(rpcId: string, params: any[], _retryCount = 0): Promise<any> {
    const fReq = JSON.stringify([null, JSON.stringify(params)]);
    const body = new URLSearchParams();
    body.append('f.req', fReq);
    if (this.csrfToken) {
      body.append('at', this.csrfToken);
    }

    try {
      const response = await this.client.post(BATCH_EXECUTE_PATH, body.toString(), {
        params: {
          'rpcids': rpcId,
          'source-path': '/',
          'f.sid': this.sessionId,
          'bl': 'boq_labs-tailwind-frontend_20260108.06_p0',
          'hl': 'en',
          '_reqid': Math.floor(Math.random() * 1000000).toString(),
          'rt': 'c'
        }
      });

      // Special case: Google might return success but the body indicates an internal auth failure
      // (usually represented by specific error codes in the response array)
      if (typeof response.data === 'string' && response.data.includes('session expired')) {
        throw new AuthenticationError('Session expired in response body');
      }

      return this.parseBatchResponse(response.data, rpcId);
    } catch (error: any) {
      const isAuthError = 
        error instanceof AuthenticationError || 
        error.response?.status === 401 || 
        error.response?.status === 403;

      if (isAuthError && _retryCount < 2) {
        console.error(`Auth failure detected. Attempting token recovery (Attempt ${_retryCount + 1})...`);
        await this.refreshTokens();
        return this.callRpc(rpcId, params, _retryCount + 1);
      }
      
      if (isAuthError) {
        throw new AuthenticationError('Authentication failed after retries. Please run notebook-mcp-auth.');
      }
      
      throw error;
    }
  }

  /**
   * Parses the weird batchexecute envelope format.
   */
  private parseBatchResponse(data: string, rpcId: string): any {
    // Google's format is basically a set of chunked JSON arrays
    // We need to extract the actual payload for the given rpcId
    try {
      const lines = data.split('\n');
      for (const line of lines) {
        if (line.includes(rpcId)) {
          const match = line.match(/\["wobti",\s*"(.*?)",\s*"(.*?)"\]/);
          if (match) {
            const innerJson = match[2].replace(/\\"/g, '"').replace(/\\\\/g, '\\');
            return JSON.parse(innerJson);
          }
        }
      }
    } catch (e) {
      console.error('Failed to parse RPC response', e);
    }
    return null;
  }

  async listNotebooks(): Promise<Notebook[]> {
    const result = await this.callRpc(RPC_IDS.LIST_NOTEBOOKS, []);
    // Typical response structure for list: [ [ [id, title, ...], ... ] ]
    if (!result || !Array.isArray(result[0])) return [];
    
    return result[0].map((item: any) => ({
      id: item[0],
      title: item[1],
      lastModified: item[2],
    }));
  }

  async createNotebook(title: string): Promise<string> {
    const result = await this.callRpc(RPC_IDS.CREATE_NOTEBOOK, [title, null, null]);
    return result?.[0] || '';
  }

  async deleteNotebook(notebookId: string): Promise<boolean> {
    await this.callRpc(RPC_IDS.DELETE_NOTEBOOK, [notebookId]);
    return true;
  }

  async renameNotebook(notebookId: string, newTitle: string): Promise<boolean> {
    await this.callRpc(RPC_IDS.RENAME_NOTEBOOK, [notebookId, newTitle]);
    return true;
  }

  async addUrlSource(notebookId: string, url: string): Promise<string> {
    const isYoutube = url.toLowerCase().includes('youtube.com') || url.toLowerCase().includes('youtu.be');
    const sourceData = isYoutube 
      ? [null, null, null, null, null, null, null, [url], 9, null, 1]
      : [null, null, [url], null, 5, null, null, null, null, null, 1];

    const params = [[sourceData], notebookId, [2], [1, null, null, null, null, null, null, null, null, null, [1]]];
    const result = await this.callRpc(RPC_IDS.ADD_SOURCE, params);
    return result?.[0]?.[0]?.[0]?.[0] || '';
  }

  async addTextSource(notebookId: string, title: string, content: string): Promise<string> {
    const sourceData = [null, [title, content], null, 4, null, null, null, null, null, null, 1];
    const params = [[sourceData], notebookId, [2], [1, null, null, null, null, null, null, null, null, null, [1]]];
    const result = await this.callRpc(RPC_IDS.ADD_SOURCE, params);
    return result?.[0]?.[0]?.[0]?.[0] || '';
  }

  async addDriveSource(notebookId: string, fileId: string): Promise<string> {
    // Drive sources use type 1 (Docs/Slides) or 2 (Other)
    const sourceData = [fileId, null, null, 1, null, null, null, null, null, null, 1];
    const params = [[sourceData], notebookId, [2], [1, null, null, null, null, null, null, null, null, null, [1]]];
    const result = await this.callRpc(RPC_IDS.ADD_SOURCE, params);
    return result?.[0]?.[0]?.[0]?.[0] || '';
  }

  async deleteSource(notebookId: string, sourceId: string): Promise<boolean> {
    await this.callRpc(RPC_IDS.DELETE_SOURCE, [notebookId, [[sourceId]]]);
    return true;
  }

  async syncDriveSource(notebookId: string, sourceId: string): Promise<boolean> {
    await this.callRpc(RPC_IDS.SYNC_DRIVE_SOURCE, [notebookId, [sourceId]]);
    return true;
  }

  async startResearch(notebookId: string, query: string, source: 'web' | 'drive' = 'web', mode: 'fast' | 'deep' = 'fast'): Promise<any> {
    const isDeep = mode === 'deep';
    const sourceType = source === 'web' ? 1 : 2;
    const rpcId = isDeep ? RPC_IDS.START_DEEP_RESEARCH : RPC_IDS.START_FAST_RESEARCH;
    
    const params = isDeep 
      ? [null, [1], [query, sourceType], 5, notebookId]
      : [[query, sourceType], null, 1, notebookId];

    return await this.callRpc(rpcId, params);
  }

  async pollResearch(notebookId: string): Promise<any> {
    const params = [null, null, notebookId];
    return await this.callRpc(RPC_IDS.POLL_RESEARCH, params);
  }

  async importResearchSources(notebookId: string, taskId: string, sources: any[]): Promise<any[]> {
    const sourceArray = sources.map(src => {
      const url = src.url || '';
      const title = src.title || 'Untitled';
      const resultType = src.result_type || 1;

      if (resultType === 1) {
        // Web source
        return [null, null, [url, title], null, null, null, null, null, null, null, 2];
      } else {
        // Drive source
        let docId = null;
        if (url.includes('id=')) {
          docId = url.split('id=')[1].split('&')[0];
        }
        if (docId) {
          const mimeTypes: any = {
            2: "application/vnd.google-apps.document",
            3: "application/vnd.google-apps.presentation",
            8: "application/vnd.google-apps.spreadsheet",
          };
          const mimeType = mimeTypes[resultType] || "application/vnd.google-apps.document";
          return [[docId, mimeType, 1, title], null, null, null, null, null, null, null, null, null, 2];
        }
        return [null, null, [url, title], null, null, null, null, null, null, null, 2];
      }
    });

    const params = [null, [1], taskId, notebookId, sourceArray];
    const result = await this.callRpc(RPC_IDS.IMPORT_RESEARCH, params);
    
    const imported: any[] = [];
    if (result && Array.isArray(result[0])) {
      result[0].forEach((src: any) => {
        if (src[0] && src[0][0]) {
          imported.push({ id: src[0][0], title: src[1] });
        }
      });
    }
    return imported;
  }

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
    if (result && result[0]) {
      const inner = result[0];
      return {
        mind_map_json: inner[0],
        generation_id: inner[2]?.[0],
      };
    }
    return null;
  }

  async saveMindMap(notebookId: string, mindMapJson: string, sourceIds: string[], title: string = "Mind Map"): Promise<any> {
    const sourcesSimple = sourceIds.map(sid => [sid]);
    const metadata = [2, null, null, 5, sourcesSimple];
    const params = [notebookId, mindMapJson, metadata, null, title];
    const result = await this.callRpc(RPC_IDS.SAVE_MIND_MAP, params);
    if (result && result[0]) {
      const inner = result[0];
      return {
        mind_map_id: inner[0],
        title: inner[4],
        mind_map_json: inner[1],
      };
    }
    return null;
  }

  async listMindMaps(notebookId: string): Promise<any[]> {
    const result = await this.callRpc(RPC_IDS.LIST_MIND_MAPS, [notebookId]);
    if (!result || !Array.isArray(result[0])) return [];
    return result[0].map((mm: any) => ({
      id: mm[0],
      title: mm[4],
      json: mm[1]
    }));
  }

  async deleteMindMap(notebookId: string, mindMapId: string): Promise<boolean> {
    // 1. Get timestamp (required for full sync delete in BoQ)
    const list = await this.callRpc(RPC_IDS.LIST_MIND_MAPS, [notebookId]);
    let timestamp = null;
    if (list && Array.isArray(list[0])) {
      const mm = list[0].find((e: any) => e[0] === mindMapId);
      if (mm && mm[1] && mm[1][2]) timestamp = mm[1][2][2];
    }

    // 2. Step 1: UUID delete
    await this.callRpc(RPC_IDS.DELETE_MIND_MAP, [notebookId, null, [mindMapId], [2]]);
    
    // 3. Step 2: Timestamp sync (optional but ensures UI consistency)
    if (timestamp) {
      await this.callRpc(RPC_IDS.LIST_MIND_MAPS, [notebookId, null, timestamp, [2]]);
    }
    return true;
  }

  async createAudioOverview(notebookId: string, sourceIds: string[], language: string = 'en', format: number = 1): Promise<any> {
    const sourcesNested = sourceIds.map(sid => [[sid]]);
    const audioOptions = [[null, language, null, format, 2]];
    const params = [[2], notebookId, [null, null, 1, sourcesNested, null, null, audioOptions]];
    return await this.callRpc(RPC_IDS.STUDIO_GENERATE, params);
  }

  async pollStudioStatus(notebookId: string): Promise<any[]> {
    const params = [[2], notebookId, 'NOT artifact.status = "ARTIFACT_STATUS_SUGGESTED"'];
    const result = await this.callRpc(RPC_IDS.STUDIO_STATUS, params);
    return result?.[0] || [];
  }

  /**
   * Reads a local file, parses its content, and adds it as a text source.
   */
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

  /**
   * Complex query method with streaming support.
   */
  async query(
    notebookId: string,
    queryText: string,
    sourceIds?: string[],
    conversationId?: string
  ): Promise<any> {
    const cid = conversationId || uuidv4();
    const sources = sourceIds ? sourceIds.map(id => [[id]]) : [];
    
    // Structure matching Python: [sources_array, query_text, history, [2, null, [1]], conversation_id]
    const params = [
      sources,
      queryText,
      null, // history
      [2, null, [1]],
      cid
    ];

    const fReq = JSON.stringify([null, JSON.stringify(params)]);
    const body = new URLSearchParams();
    body.append('f.req', fReq);
    if (this.csrfToken) {
      body.append('at', this.csrfToken);
    }

    const urlParams = new URLSearchParams({
      'bl': 'boq_labs-tailwind-frontend_20260108.06_p0',
      'hl': 'en',
      '_reqid': '100000',
      'rt': 'c'
    });
    if (this.sessionId) {
      urlParams.append('f.sid', this.sessionId);
    }

    const url = `${BASE_URL}${QUERY_PATH}?${urlParams.toString()}`;
    
    // Using axios with responseType stream for future-proofing
    const response = await this.client.post(url, body.toString());
    
    // Parse the response text for the answer
    const answer = this.parseQueryResponse(response.data);

    return {
      answer,
      conversation_id: cid
    };
  }

  private parseQueryResponse(data: string): string {
    // Remove anti-XSSI prefix
    if (data.startsWith(")]}'")) {
      data = data.substring(4);
    }

    const lines = data.split('\n');
    let longestAnswer = '';
    let longestThinking = '';

    let i = 0;
    while (i < lines.length) {
      const line = lines[i].trim();
      if (!line) {
        i++;
        continue;
      }

      // Check if it's a byte count (indicates next line is JSON)
      const byteCount = parseInt(line);
      if (!isNaN(byteCount)) {
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
        // Try parsing directly
        const { text, isAnswer } = this.extractFromChunk(line);
        if (text) {
          if (isAnswer && text.length > longestAnswer.length) longestAnswer = text;
          else if (!isAnswer && text.length > longestThinking.length) longestThinking = text;
        }
        i++;
      }
    }
    
    return longestAnswer || longestThinking || "No answer received.";
  }

  private extractFromChunk(jsonStr: string): { text: string | null; isAnswer: boolean } {
    try {
      const data = JSON.parse(jsonStr);
      if (!Array.isArray(data) || data.length === 0) return { text: null, isAnswer: false };

      for (const item of data) {
        if (!Array.isArray(item) || item[0] !== 'wrb.fr') continue;

        const innerData = JSON.parse(item[2]);
        if (Array.isArray(innerData) && innerData.length > 0) {
          const firstElem = innerData[0];
          if (Array.isArray(firstElem) && firstElem.length > 0) {
            const answerText = firstElem[0];
            if (typeof answerText === 'string' && answerText.length > 10) {
              let isAnswer = false;
              if (firstElem.length > 4 && Array.isArray(firstElem[4])) {
                const typeInfo = firstElem[4];
                isAnswer = typeInfo[typeInfo.length - 1] === 1;
              }
              return { text: answerText, isAnswer };
            }
          }
        }
      }
    } catch (e) { /* ignore */ }
    return { text: null, isAnswer: false };
  }

  /**
   * Fetches the CSRF token (at) from the main page if not present.
   */
  async refreshTokens(): Promise<void> {
    const response = await this.client.get('/');
    const match = response.data.match(/"SNlM0e":"(.*?)"/);
    if (match) {
      this.csrfToken = match[1];
    }
  }
}
