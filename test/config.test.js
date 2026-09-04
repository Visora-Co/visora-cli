// Config-store tests — uses a temp HOME so they never touch the user's real
// ~/.visora/config.json.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import os from 'os';
import path from 'path';
import fs from 'fs';

const TMP_HOME = path.join(os.tmpdir(), `visora-cli-test-${process.pid}`);
const TMP_CONFIG = path.join(TMP_HOME, '.visora', 'config.json');

beforeEach(() => {
  fs.rmSync(TMP_HOME, { recursive: true, force: true });
  process.env.HOME = TMP_HOME;          // unix
  process.env.USERPROFILE = TMP_HOME;   // windows
});

afterEach(() => {
  fs.rmSync(TMP_HOME, { recursive: true, force: true });
});

describe('config store', () => {
  it('writeConfig/readConfig round-trip', () => {
    const { writeConfig, readConfig } = require('../lib/config');
    writeConfig({ host: 'https://x', idToken: 'tok' });
    expect(readConfig()).toEqual({ host: 'https://x', idToken: 'tok' });
    expect(fs.existsSync(TMP_CONFIG)).toBe(true);
  });

  it('readConfig returns null when absent', () => {
    const { readConfig } = require('../lib/config');
    expect(readConfig()).toBeNull();
  });

  it('assertLoggedIn throws when not logged in', () => {
    const { assertLoggedIn } = require('../lib/config');
    expect(() => assertLoggedIn()).toThrow('Not logged in');
  });

  it('assertLoggedIn returns config when present', () => {
    const { writeConfig, assertLoggedIn } = require('../lib/config');
    writeConfig({ host: 'https://x', idToken: 'tok' });
    expect(assertLoggedIn()).toEqual({ host: 'https://x', idToken: 'tok' });
  });

  it('clearConfig removes the file', () => {
    const { writeConfig, clearConfig, readConfig } = require('../lib/config');
    writeConfig({ host: 'https://x', idToken: 'tok' });
    clearConfig();
    expect(readConfig()).toBeNull();
  });
});
