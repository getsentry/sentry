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
            group: ['sentry/components/devtoolbar/*'],
            message: 'Do not depend on toolbar internals',
          },
        ],
        paths: [
          {
            name: '@testing-library/react',
            message:
              'Please import from `sentry-test/reactTestingLibrary` instead so that we can ensure consistency throughout the codebase',
          },
          {
            name: '@testing-library/react-hooks',
            message:
              'Please import from `sentry-test/reactTestingLibrary` instead so that we can ensure consistency throughout the codebase',
          },
          {
            name: '@testing-library/user-event',
            message:
              'Please import from `sentry-test/reactTestingLibrary` instead so that we can ensure consistency throughout the codebase',
          },
          {
            name: '@sentry/browser',
            message:
              'Please import from `@sentry/react` to ensure consistency throughout the codebase.',
          },
          {
            name: 'marked',
            message:
              "Please import marked from 'app/utils/marked' so that we can ensure sanitation of marked output",
          },
          {
            name: 'lodash',
            message:
              "Please import lodash utilities individually. e.g. `import isEqual from 'lodash/isEqual';`. See https://github.com/getsentry/frontend-handbook#lodash from for information",
          },
          {
            name: 'lodash/get',
            message:
              'Optional chaining `?.` and nullish coalescing operators `??` are available and preferred over using `lodash/get`. See https://github.com/getsentry/frontend-handbook#new-syntax for more information',
          },
          {
            name: 'sentry/utils/theme',
            importNames: ['lightColors', 'darkColors'],
            message:
              "'lightColors' and 'darkColors' exports intended for use in Storybook only. Instead, use theme prop from emotion or the useTheme hook.",
          },
          {
            name: 'react-router',
            importNames: ['withRouter'],
            message:
              "Use 'useLocation', 'useParams', 'useNavigate', 'useRoutes' from sentry/utils instead.",
          },
          {
            name: 'sentry/utils/withSentryRouter',
            importNames: ['withSentryRouter'],
            message:
              "Use 'useLocation', 'useParams', 'useNavigate', 'useRoutes' from sentry/utils instead.",
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
