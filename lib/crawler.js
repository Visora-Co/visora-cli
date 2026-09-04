/**
 * Shallow crawler for the visora-cli.
 *
 * Fetches raw HTML (no browser/Playwright) from a localhost dev server,
 * extracts { body text, title, meta, schema JSON-LD } per page, and follows
 * internal links to a bounded depth. Pages with an empty <body> (JS-only SPAs)
 * are flagged needsJsRender so the backend can fall back to server rendering.
 *
 * Spec: docs/superpowers/specs/2026-06-26-local-site-testing-design.md §2
 *   "Default shallow crawl (homepage + depth 1-2), configurable to full."
 */

'use strict';

const { load } = require('cheerio');

const DEFAULT_DEPTH = 1;       // shallow: homepage + depth-1 links
const MAX_PAGES = 50;          // spec bound on pages[]
const FETCH_TIMEOUT_MS = 8000;
const USER_AGENT = 'visora-cli/0.1 (+https://visoraco.com)';

/**
 * Crawl a site from baseUrl up to `depth`, returning extracted pages.
 *
 * @param {string} baseUrl  e.g. http://localhost:3000
 * @param {object} opts { depth, fetch: customFetch, onPage }
 * @returns {Promise<object[]>} pages matching the relay MSG.PAGE shape
 */
async function crawlSite(baseUrl, opts = {}) {
  const depth = opts.depth ?? DEFAULT_DEPTH;
  const fetchFn = opts.fetch || defaultFetch;

  const origin = new URL(baseUrl).origin;
  const seen = new Set();
  const queue = [{ url: normalizeUrl(baseUrl), depth: 0 }];
  const pages = [];

  while (queue.length && pages.length < MAX_PAGES) {
    const { url, depth: d } = queue.shift();
    if (seen.has(url)) continue;
    seen.add(url);

    let html;
    try {
      html = await fetchFn(url);
    } catch (err) {
      // unreachable page — skip, keep crawling
      continue;
    }
    if (html == null) continue;

    const page = extractPage(url, html);
    pages.push(page);
    if (opts.onPage) opts.onPage(page, pages.length);

    // enqueue same-origin links up to depth
    if (d < depth) {
      for (const link of extractLinks(html, origin)) {
        if (!seen.has(link)) queue.push({ url: link, depth: d + 1 });
      }
    }
  }
  return pages;
}

// ── extraction ───────────────────────────────────────────────────────────────

function extractPage(url, html) {
  const $ = load(html);

  // schema.org JSON-LD blocks — extract BEFORE stripping <script> tags
  // (the strip below removes all scripts, including JSON-LD, so order matters).
  const schema = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).html();
    if (raw && raw.trim()) schema.push(raw.trim());
  });

  // body text: strip script/style noise, collapse whitespace
  $('script, style, noscript').remove();
  const bodyText = $('body').text().replace(/\s+/g, ' ').trim();

  // meta
  const title = $('title').first().text().trim();
  const description = $('meta[name="description"]').attr('content')?.trim() || '';

  // empty body → JS-only SPA, needs server-side render upstream
  const needsJsRender = bodyText.length === 0;

  return {
    url,
    rawHtml: html,
    extractedText: bodyText,
    meta: { title, description },
    schema: schema.length ? schema : null,
    needsJsRender,
  };
}

function extractLinks(html, origin) {
  const $ = load(html);
  const links = new Set();
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href');
    if (!href) return;
    // resolve relative + same-origin only; skip anchors/mailto/etc
    let abs;
    try { abs = new URL(href, origin + '/').href; } catch { return; }
    if (abs.startsWith(origin)) {
      links.add(normalizeUrl(abs));
    }
  });
  return Array.from(links);
}

function normalizeUrl(u) {
  // strip trailing slash + hash/query for dedup, keep origin root as-is
  try {
    const url = new URL(u);
    return url.origin + url.pathname.replace(/\/$/, '') || url.origin;
  } catch {
    return u.replace(/#.*$/, '');
  }
}

async function defaultFetch(url) {
  const r = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    redirect: 'follow',
  });
  if (!r.ok) return null;
  const ct = r.headers.get('content-type') || '';
  if (!ct.includes('text/html')) return null; // skip assets/PDFs
  return r.text();
}

module.exports = { crawlSite, extractPage, extractLinks, normalizeUrl, DEFAULT_DEPTH, MAX_PAGES };
