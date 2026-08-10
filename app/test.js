const assert = require('assert');
const http = require('http');

const PORT = 4000;
process.env.PORT = PORT;

require('./index.js');

function get(path) {
  return new Promise((resolve, reject) => {
    http.get(`http://localhost:${PORT}${path}`, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(body) }));
    }).on('error', reject);
  });
}

async function run() {
  const res = await get('/health');
  assert.strictEqual(res.status, 200, 'Expected /health to return 200');
  assert.strictEqual(res.body.status, 'ok', 'Expected /health body to report status: ok');

  const root = await get('/');
  assert.strictEqual(root.status, 200, 'Expected / to return 200');
  assert.ok(root.body.message, 'Expected / to return a message field');

  console.log('All tests passed.');
  process.exit(0);
}

run().catch((err) => {
  console.error('Test failed:', err.message);
  process.exit(1);
});
