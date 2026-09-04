#!/usr/bin/env node
/** visora-cli entry — parses the subcommand and dispatches. */
'use strict';

const { login, logout } = require('../commands/login');
const { connect } = require('../commands/connect');

function usage() {
  console.log(`visora — test your local site's AI visibility before launch

Usage:
  visora login <host> <firebase-id-token>   store credentials
  visora connect [--port N] [--depth shallow|full]   crawl + analyze
  visora logout                              clear stored credentials

Options:
  --port N            local dev port (default 3000)
  --depth shallow     homepage + first-level links (default)
  --depth full        homepage + two levels
`);
}

async function main(argv) {
  const [cmd, ...rest] = argv.slice(2);
  if (!cmd || cmd === 'help' || cmd === '--help' || cmd === '-h') {
    usage();
    return 0;
  }

  switch (cmd) {
    case 'login':
      login(rest[0], rest[1]);
      return 0;

    case 'logout':
      logout();
      return 0;

    case 'connect': {
      const opts = parseConnectArgs(rest);
      await connect(opts);
      return 0;
    }

    default:
      console.error(`Unknown command: ${cmd}`);
      usage();
      return 1;
  }
}

function parseConnectArgs(args) {
  const opts = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--port') opts.port = parseInt(args[++i], 10);
    else if (args[i] === '--depth') opts.depthName = args[++i];
  }
  return opts;
}

main(process.argv).then((code) => process.exit(code)).catch((err) => {
  console.error(err.message);
  process.exit(1);
});
