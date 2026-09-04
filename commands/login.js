/** `visora login` — store the Visora host + a Firebase ID token locally. */
'use strict';

const { writeConfig, readConfig } = require('../lib/config');

function login(host, idToken) {
  if (!host) {
    console.error('Usage: visora login <https://your-visora-host> <firebase-id-token>');
    process.exit(1);
  }
  if (!idToken) {
    console.error('Missing Firebase ID token. Get one from the Visora dashboard (Profile → API access).');
    process.exit(1);
  }
  // normalize: strip trailing slash
  host = host.replace(/\/$/, '');

  writeConfig({ host, idToken });
  console.log(`✓ Logged in to ${host}`);
  console.log('  Next: visora connect --port 3000');
}

function logout() {
  const { clearConfig } = require('../lib/config');
  const was = readConfig();
  clearConfig();
  if (was) console.log('✓ Logged out.');
  else console.log('Not logged in.');
}

module.exports = { login, logout };
