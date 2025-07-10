'use strict';

// Do this as the first thing so that any code reading it knows the right env.
// process.env.BABEL_ENV = 'test';
process.env.NODE_ENV = 'test';
process.env.PUBLIC_URL = '';
process.env.TZ = 'America/New_York';

// We have a jest.config.ts file in ESM syntax but with verbatimModuleSyntax,
// this is seen as a CommonJS file by Jest because we don't have type: "module" set in package.json.
// The separate tsconfig.jest.json file turns off verbatimModuleSyntax
process.env.TS_NODE_PROJECT = 'tsconfig.jest.json';

// Makes the script crash on unhandled rejections instead of silently
// ignoring them. In the future, promise rejections that are not handled will
// terminate the Node.js process with a non-zero exit code.
process.on('unhandledRejection', err => {
  throw err;
});

let argv = process.argv.slice(2);

// Remove watch if in CI or in coverage mode
if (process.env.CI || process.env.SENTRY_PRECOMMIT || argv.includes('--coverage')) {
  argv = argv.filter(arg => arg !== '--watch');
}

require('jest').run(argv);
