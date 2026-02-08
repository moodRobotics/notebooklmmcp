/**
 * Diagnostic test for notebook_query: dump raw response to see what's coming back.
 * Usage: npx tsx examples/test-query.ts <notebook_id> [query_text]
 */
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';

const BASE_URL = 'https://notebooklm.google.com';
const QUERY_PATH = '/_/LabsTailwindUi/data/google.internal.labs.tailwind.orchestration.v1.LabsTailwindOrchestrationService/GenerateFreeFormStreamed';
const BUILD_LABEL = 'boq_labs-tailwind-frontend_20260108.06_p0';

// Load cookies
const authPath = path.join(os.homedir(), '.notebooklm-mcp', 'auth.json');
const authData = JSON.parse(fs.readFileSync(authPath, 'utf-8'));
const cookies: string = authData.cookies;

const notebookId = process.argv[2] || '294bac53-bd5e-43d2-9038-fbe239e15993';
const queryText = process.argv[3] || '¿De qué trata este cuaderno?';

console.log('=== Query Diagnostic ===');
console.log('Notebook:', notebookId);
console.log('Query:', queryText);

// Step 1: Init - get CSRF token
const client = axios.create({
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

console.log('\n=== Step 1: Init (CSRF) ===');
const initResp = await client.get('/', {
  headers: {
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  maxRedirects: 5,
});

const html = initResp.data as string;
const csrfMatch = html.match(/"SNlM0e"\s*:\s*"([^"]+)"/);
const sidMatch = html.match(/"FdrFJe"\s*:\s*"([^"]+)"/);
const csrfToken = csrfMatch?.[1] || '';
const sessionId = sidMatch?.[1] || '';
console.log('CSRF token:', csrfToken ? csrfToken.substring(0, 20) + '...' : 'MISSING');
console.log('Session ID:', sessionId ? sessionId.substring(0, 20) + '...' : 'MISSING');

// Step 2: Build query request
console.log('\n=== Step 2: Build Query Request ===');
const cid = uuidv4();
const sources: any[] = [];
const params = [sources, queryText, null, [2, null, [1]], cid];
const paramsJson = JSON.stringify(params);
const fReq = JSON.stringify([null, paramsJson]);

console.log('Params JSON:', paramsJson.substring(0, 200));
console.log('f.req:', fReq.substring(0, 200));

const bodyParts: string[] = [];
bodyParts.push(`f.req=${encodeURIComponent(fReq)}`);
if (csrfToken) {
  bodyParts.push(`at=${encodeURIComponent(csrfToken)}`);
}
const body = bodyParts.join('&') + '&';

const reqidCounter = Math.floor(Math.random() * 900000 + 100000) + 100000;
const urlParams: Record<string, string> = {
  'bl': BUILD_LABEL,
  'hl': 'en',
  '_reqid': String(reqidCounter),
  'rt': 'c',
};
if (sessionId) {
  urlParams['f.sid'] = sessionId;
}
const qs = Object.entries(urlParams).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
const url = `${BASE_URL}${QUERY_PATH}?${qs}`;

console.log('URL:', url.substring(0, 150) + '...');

// Step 3: Send query
console.log('\n=== Step 3: Send Query ===');
try {
  const response = await client.post(url, body, { timeout: 120000 });
  const data = response.data as string;
  
  console.log('Status:', response.status);
  console.log('Response length:', data.length);
  console.log('\n=== RAW RESPONSE (first 2000 chars) ===');
  console.log(data.substring(0, 2000));
  console.log('\n=== END RAW ===');

  // Try to parse it
  let cleaned = data;
  if (cleaned.startsWith(")]}'")) {
    cleaned = cleaned.substring(4);
  }

  const lines = cleaned.split('\n').filter(l => l.trim());
  console.log('\n=== Lines breakdown ===');
  console.log('Total non-empty lines:', lines.length);
  
  for (let i = 0; i < Math.min(lines.length, 20); i++) {
    const line = lines[i].trim();
    const isNumber = !isNaN(parseInt(line)) && String(parseInt(line)) === line;
    if (isNumber) {
      console.log(`Line ${i}: [byte count] ${line}`);
    } else {
      try {
        const parsed = JSON.parse(line);
        console.log(`Line ${i}: [VALID JSON] length=${line.length}`);
        // Check for wrb.fr
        if (Array.isArray(parsed)) {
          for (const item of parsed) {
            if (Array.isArray(item) && item[0] === 'wrb.fr') {
              console.log(`  -> Has wrb.fr! rpcId=${item[1]}, inner data length=${typeof item[2] === 'string' ? item[2].length : 'N/A'}`);
              if (typeof item[2] === 'string') {
                try {
                  const inner = JSON.parse(item[2]);
                  console.log(`  -> Inner parsed. Type: ${Array.isArray(inner) ? 'array[' + inner.length + ']' : typeof inner}`);
                  if (Array.isArray(inner) && inner.length > 0) {
                    const first = inner[0];
                    if (Array.isArray(first) && first.length > 0) {
                      const text = first[0];
                      console.log(`  -> first[0] type: ${typeof text}, length: ${typeof text === 'string' ? text.length : 'N/A'}`);
                      if (typeof text === 'string') {
                        console.log(`  -> TEXT PREVIEW: "${text.substring(0, 200)}"`);
                      }
                    }
                  }
                } catch (e) {
                  console.log(`  -> Inner parse failed`);
                }
              }
            }
          }
        }
      } catch {
        console.log(`Line ${i}: [NOT JSON] preview: "${line.substring(0, 100)}"`);
      }
    }
  }

  // Also check if the query URL expects notebook_id somewhere
  console.log('\n=== IMPORTANT: notebook_id was NOT included in query params! ===');
  console.log('The query() method receives notebookId but never uses it in the request body.');
  console.log('This might be the bug — checking Python reference...');

} catch (e: any) {
  console.error('Query failed:', e.message);
  if (e.response) {
    console.error('Status:', e.response.status);
    console.error('Data preview:', String(e.response.data).substring(0, 500));
  }
}
