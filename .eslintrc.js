/* eslint-env node */

const detectDeprecations = !!process.env.SENTRY_DETECT_DEPRECATIONS;

module.exports = {
  root: true,
  extends: detectDeprecations
    ? ['sentry-app/strict', 'plugin:deprecation/recommended']
    : ['sentry-app/strict'],

  parserOptions: detectDeprecations
    ? {
        project: './tsconfig.json',
      }
    : {},

  globals: {
    require: false,
    expect: false,
    MockApiClient: true,
    tick: true,
    jest: true,
  },
  rules: {
    'react-hooks/exhaustive-deps': [
      'error',
      {additionalHooks: '(useEffectAfterFirstRender|useMemoWithPrevious)'},
    ],
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            group: ['@radix-ui/*'],
            message: '@radix-ui is intended for devtoolbar only',
          },
          {
            group: ['sentry/components/devtoolbar/*'],
            message: 'Do not depend on toolbar internals',
          },
        ],
      },
    ],

    // TODO(@anonrig): Remove this from eslint-sentry-config
    'space-infix-ops': 'off',
    'object-shorthand': 'off',
    'object-curly-spacing': 'off',
    'import/no-amd': 'off',
    'no-danger-with-children': 'off',
    'no-fallthrough': 'off',
    'no-obj-calls': 'off',
    'array-bracket-spacing': 'off',
    'computed-property-spacing': 'off',
    'react/no-danger-with-children': 'off',
    'jest/no-disabled-tests': 'off',
  },
  // JSON file formatting is handled by Biome. ESLint should not be linting
  // and formatting these files.
  ignorePatterns: ['*.json'],
  overrides: [
    {
      files: ['static/app/components/devtoolbar/**/*.{ts,tsx}'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            paths: [
              {
                name: 'sentry/utils/queryClient',
                message:
                  'Import from `@tanstack/react-query` and `./hooks/useFetchApiData` or `./hooks/useFetchInfiniteApiData` instead.',
              },
            ],
          },
        ],
      },
    },
    {
      files: ['static/**/*.spec.{ts,js}', 'tests/js/**/*.{ts,js}'],
      extends: ['plugin:testing-library/react', 'sentry-app/strict'],
      rules: {
        // TODO(@anonrig): Remove this from eslint-sentry-config
        'space-infix-ops': 'off',
        'object-shorthand': 'off',
        'object-curly-spacing': 'off',
        'import/no-amd': 'off',
        'no-danger-with-children': 'off',
        'no-fallthrough': 'off',
        'no-obj-calls': 'off',
        'array-bracket-spacing': 'off',
        'computed-property-spacing': 'off',
        'react/no-danger-with-children': 'off',
        'jest/no-disabled-tests': 'off',
      },
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
