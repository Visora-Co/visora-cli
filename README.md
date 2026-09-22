# visora-cli

Connect your local dev site to [Visora](https://visoraco.com) and test, *before launch*, whether it
will be visible to AI search engines (GEO) and rank well in traditional search
(SEO). Runs in your terminal loop — re-run `visora connect` after every
content/schema iteration to see if visibility improved.

Visora is the AI visibility platform for Hong Kong SMBs: it measures how often
ChatGPT, Google AI Overviews, Gemini, Perplexity, Copilot, Doubao, DeepSeek, and
Qwen recommend a business, and gives you the tools to improve it. Free
60-second scan, no account required: **https://visoraco.com/scan**

## Install (from source)

```bash
git clone https://github.com/Visora-Co/visora-cli.git
cd visora-cli
npm install
npm link        # makes `visora` available globally
```

Requires Node 18+.

## Usage

```bash
# 1. one-time login — get the host + Firebase ID token from your Visora
#    dashboard (Profile → API access)
visora login https://visoraco.com <firebase-id-token>

# 2. start your dev server in another terminal, then connect
visora connect --port 3000                 # shallow: homepage + links
visora connect --port 3000 --depth full    # homepage + two levels

# 3. results stream into your Visora dashboard as they compute

visora logout
```

## What it does

1. Crawls `localhost:<port>` (raw HTML fetch — no browser; ~5MB binary).
2. Extracts per-page `{ body text, title, meta, schema JSON-LD }`. Flags
   JS-only SPAs (empty `<body>`) for server-side rendering upstream.
3. Streams pages to the Visora relay over an authenticated WebSocket.
4. The backend runs the pre-check engine + retrieval simulation + LLM-judge
   and surfaces a diagnose→prescribe report in your dashboard.

## Honest limitations (v1)

- Requires Node installed (packaged binaries for non-Node users are later).
- JS-only SPAs hit the server-render fallback for flagged pages — most modern
  dev sites are SSR/SSG and work with zero rendering.
- Shallow crawl is homepage + depth 1; `--depth full` adds a second level.

## Development

```bash
npm test        # vitest — crawler extraction + config store
```

The crawler is testable with an injected `fetch` (no real server needed).

## Links

- [Visora](https://visoraco.com) — the platform this CLI connects to
- [Free AI Visibility Scan](https://visoraco.com/scan) — 0–100 score across 8 AI engines in ~60 seconds
- [State of AI Visibility 2026](https://visoraco.com/research) — original research from live multi-engine scan data (Hong Kong)
- [AIV Methodology](https://visoraco.com/research/methodology) — the public scoring model
- [What is AI Visibility?](https://visoraco.com/ai-visibility) — the Hong Kong guide to being recommended by AI

## License

MIT — see [LICENSE](LICENSE).
