/* eslint-env node */
/* eslint import/no-nodejs-modules:0 */

const process = require('process');

const isRelaxed = !!process.env.SENTRY_ESLINT_RELAXED;
const isCi = !!process.env.CI;

// Strict ruleset that runs on pre-commit and in local environments
const strictRulesNotCi = {
  'react-hooks/exhaustive-deps': ['error'],
};

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

  rules: {
    ...(!isRelaxed && !isCi ? strictRulesNotCi : {}),
  },

  overrides: [
    {
      files: ['*.ts', '*.tsx'],
      rules: {},
    },
  ],
};
