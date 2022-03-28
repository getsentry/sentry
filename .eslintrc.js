/* eslint-env node */
/* eslint import/no-nodejs-modules:0 */

const process = require('process');

const isRelaxed = !!process.env.SENTRY_ESLINT_RELAXED;

module.exports = {
  extends: [isRelaxed ? 'sentry-app' : 'sentry-app/strict'],
  globals: {
    require: false,
    expect: false,
    sinon: false,
    MockApiClient: true,
    TestStubs: true,
    tick: true,
    jest: true,
  },

  rules: {},

  overrides: [
    {
      files: ['*.ts', '*.tsx'],
      rules: {},
    },
  ],
};
