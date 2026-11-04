#!/usr/bin/env node
import process from 'node:process';
import {fileURLToPath} from 'node:url';

import {run} from 'jest';

// Do this as the first thing so that any code reading it knows the right env.
process.env.NODE_ENV = 'test';
process.env.PUBLIC_URL = '';
process.env.TZ = 'America/New_York';

// Makes the script crash on unhandled rejections instead of silently
// ignoring them. In the future, promise rejections that are not handled will
// terminate the Node.js process with a non-zero exit code.
process.on('unhandledRejection', err => {
  throw err;
});

let argv = process.argv.slice(2);

// Use the full CI config unless the caller selects another config.
if (
  !argv.some(
    arg =>
      arg === '--config' ||
      arg === '-c' ||
      arg.startsWith('--config=') ||
      arg.startsWith('-c=')
  )
) {
  argv = [
    '--config',
    fileURLToPath(new URL('../jest.config.ci.mjs', import.meta.url)),
    ...argv,
  ];
}

// Remove watch if in CI or in coverage mode
if (process.env.CI || process.env.SENTRY_PRECOMMIT || argv.includes('--coverage')) {
  argv = argv.filter(arg => arg !== '--watch');
}

run(argv);
