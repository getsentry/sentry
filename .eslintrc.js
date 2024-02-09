/* eslint-env node */

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
    tick: true,
    jest: true,
  },
  rules: {
    'react-hooks/exhaustive-deps': [
      'warn',
      {additionalHooks: ADDITIONAL_HOOKS_TO_CHECK_DEPS_FOR},
    ],
    ...(!isRelaxed && !isCi ? strictRulesNotCi : {}),

    // TODO(@anonrig): Remove these rules from eslint-sentry-config.
    'import/no-nodejs-modules': 'off',
    semi: 'off',
    'use-isnan': 'off',
    curly: 'off',
    eqeqeq: 'off',
    'no-extra-semi': 'off',
    'no-eq-null': 'off',
    'comma-dangle': 'off',
    'react/jsx-no-target-blank': 'off',
    'react/jsx-no-duplicate-props': 'off',
    'react-hooks/rules-of-hooks': 'off',
    'no-duplicate-case': 'off',
    'no-dupe-keys': 'off',
    'no-redeclare': 'off',
    'no-debugger': 'off',
    'no-unreachable': 'off',
  },
  // JSON file formatting is handled by Biome. ESLint should not be linting
  // and formatting these files.
  ignorePatterns: ['*.json'],
  overrides: [
    {
      files: ['tests/js/**/*.{ts,js}'],
      extends: ['plugin:testing-library/react', 'sentry-app/strict'],
      rules: {
        // TODO(@anonrig): Remove these rules from eslint-sentry-config.
        'import/no-nodejs-modules': 'off',
        semi: 'off',
        'use-isnan': 'off',
        curly: 'off',
        eqeqeq: 'off',
        'no-extra-semi': 'off',
        'no-eq-null': 'off',
        'comma-dangle': 'off',
        'react/jsx-no-target-blank': 'off',
        'react/jsx-no-duplicate-props': 'off',
        'react-hooks/rules-of-hooks': 'off',
        'no-duplicate-case': 'off',
        'no-dupe-keys': 'off',
        'no-redeclare': 'off',
        'no-debugger': 'off',
        'no-unreachable': 'off',
      },
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
