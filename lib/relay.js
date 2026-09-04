/**
 * Relay client for the visora-cli — the other end of the WebSocket protocol.
 *
 * Mirrors services/local-site/protocol.js exactly (duplicated here so the CLI
 * is a standalone package with no dependency on the main app). Flow:
 *   open → send AUTH → wait for AUTH_OK → stream PAGE → CRAWL_COMPLETE
 *
 * Exposes a small event API so the `connect` command can render progress.
 */

'use strict';

const { WebSocket } = require('ws');

// ── protocol (mirror of services/local-site/protocol.js) ─────────────────────
const MSG = {
  AUTH:           'auth',
  PAGE:           'page',
  CRAWL_COMPLETE: 'crawl_complete',
  DISCONNECT:     'disconnect',
};
const ACK = {
  AUTH_OK:      'auth_ok',
  PAGE_ACK:     'page_ack',
  CRAWL_QUEUED: 'crawl_queued',
  ERROR:        'error',
};
const RELAY_PATH = '/local-site-relay';

/**
 * Connect to the relay and run a crawl→stream cycle.
 *
 * @param {object} opts
 * @param {string} opts.host        Visora API host, e.g. https://app.visoraco.com
 * @param {string} opts.sessionToken relay session token (from POST /api/local-site/session)
 * @param {object[]} opts.pages      crawled pages to stream
 * @param {function} opts.onAuth     (ack) => void
 * @param {function} opts.onPageAck  (ack) => void   — per page
 * @param {function} opts.onQueued   () => void       — crawl_complete accepted
 * @param {function} opts.onError    (err) => void
 * @param {function} opts.onDone     () => void       — server finished orchestrating (optional 'done' msg)
 * @returns {Promise<void>} resolves when the cycle completes (queued + optional done)
 */
function connectAndStream(opts) {
  const { host, sessionToken, pages, onAuth, onPageAck, onQueued, onError, onDone } = opts;
  const url = host.replace(/^http/, 'ws') + RELAY_PATH;
  const ws = new WebSocket(url);

  return new Promise((resolve, reject) => {
    let authed = false;
    let queued = false;

    const finish = () => { try { ws.close(); } catch { /* noop */ } resolve(); };

    ws.on('open', () => {
      ws.send(JSON.stringify({ type: MSG.AUTH, token: sessionToken }));
    });

    ws.on('message', (raw) => {
      let msg;
      try { msg = JSON.parse(raw.toString()); }
      catch { return; }

      switch (msg.type) {
        case ACK.AUTH_OK:
          authed = true;
          if (onAuth) onAuth(msg);
          // stream all pages, then signal completion
          for (const p of pages) {
            ws.send(JSON.stringify({ type: MSG.PAGE, ...p }));
          }
          ws.send(JSON.stringify({ type: MSG.CRAWL_COMPLETE }));
          break;

        case ACK.PAGE_ACK:
          if (onPageAck) onPageAck(msg);
          break;

        case ACK.CRAWL_QUEUED:
          queued = true;
          if (onQueued) onQueued();
          // orchestrator runs async; if it never sends 'done', resolve on queued
          // after a grace window. The server-side stub (Phase 4) acks only.
          if (!onDone) setTimeout(finish, 500);
          break;

        case ACK.ERROR:
          if (onError) onError(new Error(msg.message || 'relay error'));
          reject(new Error(msg.message || 'relay error'));
          break;

        default:
          // 'done' / 'info' etc. from the orchestrator
          if (queued && onDone) { onDone(); finish(); }
          break;
      }
    });

    ws.on('error', (err) => {
      if (onError) onError(err);
      reject(err);
    });

    ws.on('close', () => {
      // if we queued and no explicit done, resolve
      if (queued && !onDone) resolve();
    });

    // safety: never hang forever
    setTimeout(() => {
      if (!authed) reject(new Error('relay did not authenticate within timeout'));
    }, 15_000);
  });
}

module.exports = { connectAndStream, MSG, ACK, RELAY_PATH };
