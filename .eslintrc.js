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

// const config = require('eslint-config-sentry-app');

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
      files: ['*.spec.ts', '*.spec.tsx'],
      rules: {
        // 'no-restricted-imports': [
        //   'error',
        //   {
        //     ...config.rules['no-restricted-imports'][1],
        //     patterns: [
        //       {
        //         group: ['*.spec*'],
        //         message:
        //           "Don't import from another test file as it will cause test to run twice. Move exported members to a dedicated test util file instead and then import.",
        //       },
        //     ],
        //   },
        // ],
      },
    },
  ],
};
