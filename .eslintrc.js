/* eslint-env node */
const process = require('node:process');

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
  root: true,
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
    // These rules are enabled in Biome.
    // TODO(@anonrig): Remove prettier package from package.json when eslint-sentry-app doesn't require it.
    '@typescript-eslint/no-redeclare': 'off',
    '@typescript-eslint/no-shadow': 'off',
    '@typescript-eslint/no-unused-vars': 'off',
    eqeqeq: 'off',
    'import/default': 'off',
    'import/export': 'off',
    'import/no-unresolved': 'off',
    'import/no-nodejs-modules': 'off',
    'prettier/prettier': 'off',
    'react/no-children-prop': 'off',
    'react/jsx-key': 'off',
    'react/jsx-no-duplicate-props': 'off',
    'react/jsx-no-undef': 'off',
    'react/jsx-uses-vars': 'off',
    'react/no-danger-with-children': 'off',
    'react/no-typos': 'off',
    'react/no-render-return-value': 'off',
    'react/require-render-return': 'off',
    'react/jsx-no-target-blank': 'off',
    'no-console': 'off',
    'no-debugger': 'off',
    'no-dupe-keys': 'off',
    'no-else-return': 'off',
    'no-duplicate-case': 'off',
    'no-fallthrough': 'off',
    'no-func-assign': 'off',
    'no-unreachable': 'off',
    'no-render-return-value': 'off',
    'no-self-compare': 'off',
    'no-var': 'off',
    'no-with': 'off',
    'use-isnan': 'off',

    'react-hooks/exhaustive-deps': [
      'warn',
      {additionalHooks: ADDITIONAL_HOOKS_TO_CHECK_DEPS_FOR},
    ],
    ...(!isRelaxed && !isCi ? strictRulesNotCi : {}),
  },

  overrides: [
    {
      files: ['test/js/**/*.{ts,js}'],
      extends: ['plugin:testing-library/react', 'sentry-app/strict'],
    },
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
