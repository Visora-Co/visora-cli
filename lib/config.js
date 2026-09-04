/**
 * Config store for the visora-cli.
 *
 * Persists login state to ~/.visora/config.json:
 *   { host, idToken } — the Visora API host + a Firebase ID token.
 *
 * The ID token is short-lived (~1h). `connect` exchanges it for a relay
 * session token at POST /api/local-site/session (server-side, before the
 * socket opens), so the long-lived socket never holds the Firebase token.
 */

'use strict';

const os = require('os');
const path = require('path');
const fs = require('fs');

const CONFIG_DIR = path.join(os.homedir(), '.visora');
const CONFIG_PATH = path.join(CONFIG_DIR, 'config.json');

function readConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  } catch {
    return null;
  }
}

function writeConfig(config) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
  // Best-effort tighten perms (on POSIX). Windows ignores mode on existing files.
  try { fs.chmodSync(CONFIG_PATH, 0o600); } catch { /* noop */ }
}

function clearConfig() {
  try { fs.unlinkSync(CONFIG_PATH); } catch { /* already gone */ }
}

function assertLoggedIn() {
  const cfg = readConfig();
  if (!cfg || !cfg.host || !cfg.idToken) {
    throw new Error('Not logged in. Run: visora login');
  }
  return cfg;
}

module.exports = { CONFIG_DIR, CONFIG_PATH, readConfig, writeConfig, clearConfig, assertLoggedIn };
