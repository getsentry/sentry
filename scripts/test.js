/* global process */
/* eslint import/no-nodejs-modules:0 */

// Do this as the first thing so that any code reading it knows the right env.
// process.env.BABEL_ENV = 'test';
process.env.NODE_ENV = 'test';
process.env.PUBLIC_URL = '';
process.env.TZ = 'America/New_York';

// Makes the script crash on unhandled rejections instead of silently
// ignoring them. In the future, promise rejections that are not handled will
// terminate the Node.js process with a non-zero exit code.
process.on('unhandledRejection', err => {
  throw err;
});

// eslint-disable-next-line jest/no-jest-import
const jest = require('jest');

const argv = process.argv.slice(2);

// Watch unless on CI or in coverage mode
if (!process.env.CI && !process.env.SENTRY_PRECOMMIT && argv.indexOf('--coverage') < 0) {
  argv.push('--watch');
}

jest.run(argv);
