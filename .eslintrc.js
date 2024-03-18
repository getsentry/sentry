/* eslint-env node */

module.exports = {
  root: true,
  extends: ['sentry-app/strict'],
  globals: {
    expect: false,
    jest: true,
    MockApiClient: true,
    require: false,
    tick: true,
  },
  rules: {
    'react-hooks/exhaustive-deps': [
      'error',
      {additionalHooks: '(useEffectAfterFirstRender|useMemoWithPrevious)'},
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
  },
  // JSON file formatting is handled by Biome. ESLint should not be linting
  // and formatting these files.
  ignorePatterns: ['*.json'],
  overrides: [
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
