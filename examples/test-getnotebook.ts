/**
 * Debug getNotebook response structure
 */
import axios from 'axios';
import { AuthManager } from '../dist/auth.js';

const BASE_URL = 'https://notebooklm.google.com';
const BATCH_EXECUTE_PATH = '/_/LabsTailwindUi/data/batchexecute';
const BUILD_LABEL = 'boq_labs-tailwind-frontend_20260108.06_p0';

const notebookId = process.argv[2] || '294bac53-bd5e-43d2-9038-fbe239e15993';

const auth = new AuthManager();
const cookies = auth.getSavedCookies();

const client = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Cookie': cookies,
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
    'Origin': BASE_URL,
    'Referer': `${BASE_URL}/`,
    'X-Same-Domain': '1',
  },
});

// Step 1: get CSRF token
const initResp = await client.get('/');
const html = initResp.data as string;
const csrfMatch = html.match(/"SNlM0e"\s*:\s*"([^"]+)"/);
const sidMatch = html.match(/"FdrFJe"\s*:\s*"([^"]+)"/);
const csrfToken = csrfMatch?.[1] || '';
const sessionId = sidMatch?.[1] || '';

// Step 2: call GET_NOTEBOOK RPC
const rpcId = 'rLM1Ne';
const params = [notebookId, null, [2], null, 0];
const paramsJson = JSON.stringify(params);
const fReq = JSON.stringify([[[rpcId, paramsJson, null, "generic"]]]);

const bodyParts: string[] = [];
bodyParts.push(`f.req=${encodeURIComponent(fReq)}`);
if (csrfToken) bodyParts.push(`at=${encodeURIComponent(csrfToken)}`);
const body = bodyParts.join('&') + '&';

const urlParams: Record<string, string> = {
  'rpcids': rpcId,
  'source-path': `/notebook/${notebookId}`,
  'bl': BUILD_LABEL,
  'hl': 'en',
  'rt': 'c',
};
if (sessionId) urlParams['f.sid'] = sessionId;
const qs = Object.entries(urlParams).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
const url = `${BATCH_EXECUTE_PATH}?${qs}`;

console.log('=== GET_NOTEBOOK RPC ===');
console.log('rpcId:', rpcId);
console.log('params:', paramsJson);

const resp = await client.post(url, body, { timeout: 30000 });
const text = resp.data as string;
console.log('\nResponse length:', text.length);
console.log('\n=== RAW RESPONSE (first 3000 chars) ===');
console.log(text.substring(0, 3000));

// Parse to find wrb.fr entries
let cleaned = text;
if (cleaned.startsWith(")]}'")) cleaned = cleaned.substring(cleaned.indexOf('\n') + 1);

const lines = cleaned.split('\n');
console.log('\n=== Parsed entries ===');
for (let i = 0; i < lines.length; i++) {
  const line = lines[i].trim();
  if (!line || /^\d+$/.test(line)) continue;
  try {
    const parsed = JSON.parse(line);
    if (Array.isArray(parsed)) {
      for (const item of parsed) {
        if (Array.isArray(item) && item[0] === 'wrb.fr') {
          console.log(`wrb.fr found: rpcId=${item[1]}, data_type=${typeof item[2]}, data_length=${typeof item[2] === 'string' ? item[2].length : 'N/A'}`);
          if (typeof item[2] === 'string') {
            const inner = JSON.parse(item[2]);
            console.log('Inner data type:', typeof inner, Array.isArray(inner) ? `array[${inner.length}]` : '');
            
            // Try to find sources
            if (Array.isArray(inner)) {
              // Check different positions
              for (let pos = 0; pos < Math.min(inner.length, 5); pos++) {
                const elem = inner[pos];
                if (Array.isArray(elem)) {
                  console.log(`  inner[${pos}]: array[${elem.length}]`);
                  if (elem.length > 0 && typeof elem[0] === 'string') {
                    console.log(`    -> First element is string: "${elem[0].substring(0, 80)}"`);
                  }
                  if (elem.length > 1 && Array.isArray(elem[1])) {
                    console.log(`    -> inner[${pos}][1] is array[${elem[1].length}] (sources?)`);
                    if (elem[1].length > 0) {
                      console.log(`    -> First source: ${JSON.stringify(elem[1][0]).substring(0, 200)}`);
                    }
                  }
                } else {
                  console.log(`  inner[${pos}]:`, typeof elem === 'string' ? `string("${(elem as string).substring(0, 50)}")` : typeof elem);
                }
              }
            }
          }
          // Also check error signature
          if (item.length > 5) {
            console.log('Error info:', item[5], 'generic:', item[6]);
          }
        }
      }
    }
  } catch {}
}

