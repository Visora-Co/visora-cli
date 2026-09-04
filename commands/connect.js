/** `visora connect` — crawl a local site and stream it to Visora for analysis. */
'use strict';

const { assertLoggedIn } = require('../lib/config');
const { crawlSite } = require('../lib/crawler');
const { connectAndStream } = require('../lib/relay');

/**
 * @param {object} opts
 * @param {number} opts.port   local dev port (default 3000)
 * @param {number} opts.depth  crawl depth (default 1 = shallow)
 * @param {string} opts.depthName 'shallow'|'full' (maps to depth 1|2)
 */
async function connect(opts = {}) {
  const cfg = assertLoggedIn();

  const port = opts.port || 3000;
  const depthName = opts.depthName || 'shallow';
  const depth = opts.depth ?? (depthName === 'full' ? 2 : 1);
  const baseUrl = `http://localhost:${port}`;

  console.log(`→ Connecting to ${baseUrl} (depth ${depthName}: homepage + links)...`);

  // 1. crawl
  let pages;
  try {
    pages = await crawlSite(baseUrl, {
      depth,
      onPage: (_p, n) => process.stdout.write(`\r→ Crawling... ${n} pages`),
    });
    console.log('');
  } catch (err) {
    console.error(`\n✗ Could not reach ${baseUrl}: ${err.message}`);
    console.error('  Is your dev server running? Try: visora connect --port 3001');
    process.exit(1);
  }
  if (!pages.length) {
    console.error('✗ No pages found. Is your dev server running on that port?');
    process.exit(1);
  }
  const jsOnly = pages.filter((p) => p.needsJsRender).length;
  console.log(`→ Found ${pages.length} pages${jsOnly ? ` (${jsOnly} JS-only, will be server-rendered)` : ''}.`);

  // 2. mint a relay session token (exchanges the short-lived Firebase token)
  console.log('→ Authenticating with Visora...');
  let sessionToken;
  try {
    const r = await fetch(`${cfg.host}/api/local-site/session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cfg.idToken}`,
      },
      body: JSON.stringify({ depth: depthName, port }),
    });
    if (!r.ok) {
      const t = await r.text().catch(() => '');
      throw new Error(`HTTP ${r.status} ${t.slice(0, 120)}`);
    }
    const data = await r.json();
    sessionToken = data.token;
  } catch (err) {
    console.error(`✗ Authentication failed: ${err.message}`);
    process.exit(1);
  }

  // 3. stream to the relay
  console.log(`→ Streaming ${pages.length} pages to Visora...`);
  try {
    await connectAndStream({
      host: cfg.host,
      sessionToken,
      pages,
      onAuth: () => console.log('✓ Authenticated.'),
      onPageAck: (ack) => process.stdout.write(`\r→ [${ack.index}/${pages.length}] streamed`),
      onQueued: () => console.log('\n→ Crawl received. Analysis starting...'),
      onDone: () => console.log('✓ Analysis complete. Check your Visora dashboard.'),
      onError: (err) => console.error(`\n✗ Relay error: ${err.message}`),
    });
    console.log('→ Done. Results stream into your Visora dashboard as they compute.');
  } catch (err) {
    console.error(`\n✗ Stream failed: ${err.message}`);
    process.exit(1);
  }
}

module.exports = { connect };
