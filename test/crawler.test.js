// Crawler tests — extraction logic is pure (no network); crawlSite uses an
// injected fetch so no real server is needed.
import { describe, it, expect } from 'vitest';
import { extractPage, extractLinks, normalizeUrl, crawlSite } from '../lib/crawler';

const HTML = (body, extra = '') => `<!doctype html><html><head>
  <title>Test Page</title>
  <meta name="description" content="A test page." />
  <script type="application/ld+json">{"@type":"Organization","name":"Test"}</script>
  ${extra}
</head><body>${body}</body></html>`;

describe('extractPage', () => {
  it('extracts body text, title, description, schema', () => {
    const p = extractPage('http://x/a', HTML('<h1>Hi</h1><p>Hello world content here.</p>'));
    expect(p.extractedText).toContain('Hello world content here');
    expect(p.meta.title).toBe('Test Page');
    expect(p.meta.description).toBe('A test page.');
    expect(p.schema).toEqual(['{"@type":"Organization","name":"Test"}']);
    expect(p.needsJsRender).toBe(false);
  });

  it('flags an empty body as needsJsRender', () => {
    const p = extractPage('http://x/spa', HTML('<div id="root"></div>'));
    expect(p.extractedText).toBe('');
    expect(p.needsJsRender).toBe(true);
  });

  it('strips script/style noise from body text', () => {
    const p = extractPage('http://x/n', HTML('<p>real</p><script>var x=1</script><style>.a{}</style>'));
    expect(p.extractedText).toBe('real');
  });

  it('keeps rawHtml for the pre-check engine', () => {
    const p = extractPage('http://x/r', HTML('<p>x</p>'));
    expect(p.rawHtml).toContain('<p>x</p>');
  });
});

describe('extractLinks', () => {
  it('follows same-origin links only', () => {
    const links = extractLinks(
      HTML('<a href="/about">a</a><a href="http://localhost:3000/blog">b</a><a href="https://other.com/x">c</a>'),
      'http://localhost:3000'
    );
    expect(links).toContain('http://localhost:3000/about');
    expect(links).toContain('http://localhost:3000/blog');
    expect(links.some((l) => l.includes('other.com'))).toBe(false);
  });

  it('ignores mailto/anchor links', () => {
    const links = extractLinks(
      HTML('<a href="mailto:a@b.com">m</a><a href="#top">t</a><a href="/real">r</a>'),
      'http://localhost:3000'
    );
    expect(links).toContain('http://localhost:3000/real');
    expect(links.some((l) => l.startsWith('mailto'))).toBe(false);
  });
});

describe('normalizeUrl', () => {
  it('strips trailing slash and hash', () => {
    expect(normalizeUrl('http://x/a/')).toBe('http://x/a');
    expect(normalizeUrl('http://x/a#frag')).toBe('http://x/a');
  });
  it('keeps root origin', () => {
    expect(normalizeUrl('http://x/')).toBe('http://x');
  });
});

describe('crawlSite', () => {
  it('crawls with an injected fetch, bounded by depth and MAX_PAGES', async () => {
    const pages = {
      'http://localhost:3000': HTML('<a href="/a">a</a><a href="/b">b</a><p>home</p>'),
      'http://localhost:3000/a': HTML('<a href="/deep">deep</a><p>a</p>'), // /deep is depth-2, not crawled at depth 1
      'http://localhost:3000/b': HTML('<p>b</p>'),
      'http://localhost:3000/deep': HTML('<p>deep</p>'),
    };
    const fetchFn = async (url) => pages[url] ?? null;
    const result = await crawlSite('http://localhost:3000', { depth: 1, fetch: fetchFn });
    const urls = result.map((p) => p.url).sort();
    expect(urls).toEqual(['http://localhost:3000', 'http://localhost:3000/a', 'http://localhost:3000/b']);
    expect(urls).not.toContain('http://localhost:3000/deep'); // depth 2 excluded
  });

  it('skips unreachable pages and keeps going', async () => {
    const fetchFn = async (url) => (url.endsWith('/good') ? HTML('<p>good</p>') : null);
    const result = await crawlSite('http://localhost:3000/good', { depth: 0, fetch: fetchFn });
    expect(result).toHaveLength(1);
    expect(result[0].extractedText).toBe('good');
  });
});
