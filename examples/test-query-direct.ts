/**
 * Test query using the compiled client.
 * Usage: npx tsx examples/test-query-direct.ts [notebook_id] [query]
 */
import { NotebookLMClient } from '../dist/client.js';
import { AuthManager } from '../dist/auth.js';

const notebookId = process.argv[2] || '294bac53-bd5e-43d2-9038-fbe239e15993';
const queryText = process.argv[3] || '¿De qué trata este cuaderno? Resume brevemente.';

console.log('=== Query Test ===');
console.log('Notebook:', notebookId);
console.log('Query:', queryText);

const auth = new AuthManager();
const cookies = auth.getSavedCookies();
const client = new NotebookLMClient(cookies);

console.log('\nInitializing client...');
await client.init();
console.log('Client initialized.');

console.log('\nSending query (auto-fetching source IDs)...');
try {
  const result = await client.query(notebookId, queryText);
  console.log('\n=== RESULT ===');
  console.log('Answer:', result.answer.substring(0, 500));
  console.log('Conversation ID:', result.conversation_id);
  console.log('Answer length:', result.answer.length);
  
  if (result.answer === 'No answer received.') {
    console.error('\n❌ Query returned empty answer - parsing issue?');
  } else {
    console.log('\n✅ Query successful!');
  }
} catch (e: any) {
  console.error('\n❌ Query failed:', e.message);
}
