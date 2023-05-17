/* eslint-env node */
/* eslint import/no-nodejs-modules:0 */

const process = require('process');

const isRelaxed = !!process.env.SENTRY_ESLINT_RELAXED;
const isCi = !!process.env.CI;

// Strict ruleset that runs on pre-commit and in local environments
const ADDITIONAL_HOOKS_TO_CHECK_DEPS_FOR =
  '(useEffectAfterFirstRender|useMemoWithPrevious)';

const strictRulesNotCi = {
  'react-hooks/exhaustive-deps': [
    'error',
    {additionalHooks: ADDITIONAL_HOOKS_TO_CHECK_DEPS_FOR},
  ],
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
    'react-hooks/exhaustive-deps': [
      'warn',
      {additionalHooks: ADDITIONAL_HOOKS_TO_CHECK_DEPS_FOR},
    ],
    ...(!isRelaxed && !isCi ? strictRulesNotCi : {}),
  },

  overrides: [
    {
      files: ['*.ts', '*.tsx'],
      rules: {},
    },
    {
      // We specify rules explicitly for the sdk-loader here so we do not have
      // eslint ignore comments included in the source file, which is consumed
      // by users.
      files: ['**/js-sdk-loader.ts'],
      rules: {
        'no-console': 'off',
      },
    },
  ],
};
