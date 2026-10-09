const test = require('node:test');
const assert = require('node:assert');
const { parsePublicBaseUrl, resolveServers } = require('../openapi/servers');

const makeReq = ({ headers = {}, protocol = 'http', trust = true } = {}) => ({
  protocol,
  app: { get: () => trust },
  get: (h) => headers[h.toLowerCase()]
});
const opts = { publicBaseUrl: null, fallbackPort: 3001 };

test('parsePublicBaseUrl strips trailing slash and rejects invalid values', () => {
  assert.strictEqual(parsePublicBaseUrl('https://api.example.com/'), 'https://api.example.com');
  assert.strictEqual(parsePublicBaseUrl('api.example.com'), null);
  assert.strictEqual(parsePublicBaseUrl('ftp://x.com'), null);
  assert.strictEqual(parsePublicBaseUrl(''), null);
  assert.strictEqual(parsePublicBaseUrl(undefined), null);
});

test('uses request host and protocol', () => {
  const s = resolveServers(makeReq({ headers: { host: '127.0.0.1:3001' } }), opts);
  assert.strictEqual(s[0].url, 'http://127.0.0.1:3001');
  const r = resolveServers(makeReq({ headers: { host: 'x.onrender.com' }, protocol: 'https' }), opts);
  assert.strictEqual(r[0].url, 'https://x.onrender.com');
});

test('prefers X-Forwarded-Host only when trust proxy is on', () => {
  const headers = { host: 'internal:10000', 'x-forwarded-host': 'public.example.com, other' };
  assert.strictEqual(resolveServers(makeReq({ headers }), opts)[0].url, 'http://public.example.com');
  assert.strictEqual(resolveServers(makeReq({ headers, trust: false }), opts)[0].url, 'http://internal:10000');
});

test('PUBLIC_BASE_URL overrides the request host', () => {
  const s = resolveServers(makeReq({ headers: { host: 'evil.com' } }), { ...opts, publicBaseUrl: 'https://api.example.com' });
  assert.strictEqual(s[0].url, 'https://api.example.com');
});

test('malformed Host falls back to local default', () => {
  const s = resolveServers(makeReq({ headers: { host: 'evil.com/<script>' } }), opts);
  assert.strictEqual(s[0].url, 'http://127.0.0.1:3001');
});
