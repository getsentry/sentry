/* eslint-env node */

const detectDeprecations = !!process.env.SENTRY_DETECT_DEPRECATIONS;

const appRules = {
  /**
   * emotion rules for v10
   *
   * This probably aren't as necessary anymore, but let's remove when we move to v11
   */
  '@emotion/jsx-import': 'off',
  '@emotion/no-vanilla': 'error',
  '@emotion/import-from-emotion': 'error',
  '@emotion/styled-import': 'error',

  // no-undef is redundant with typescript as tsc will complain
  // A downside is that we won't get eslint errors about it, but your editors should
  // support tsc errors so....
  'no-undef': 'off',

  // Let formatter handle this
  'arrow-body-style': 'off',

  /**
   * Need to use typescript version of these rules
   */
  'no-shadow': 'off',
  '@typescript-eslint/no-shadow': 'error',

  // This only override the `args` rule (which is "none"). There are too many errors and it's difficult to manually
  // fix them all, so we'll have to incrementally update.
  'no-unused-vars': 'off',
  '@typescript-eslint/no-unused-vars': [
    'error',
    {
      vars: 'all',
      args: 'all',
      // TODO(scttcper): We could enable this to enforce catch (error)
      // https://eslint.org/docs/latest/rules/no-unused-vars#caughterrors
      caughtErrors: 'none',

      // Ignore vars that start with an underscore
      // e.g. if you want to omit a property using object spread:
      //
      //   const {name: _name, ...props} = this.props;
      //
      varsIgnorePattern: '^_',
      argsIgnorePattern: '^_',
      destructuredArrayIgnorePattern: '^_',
    },
  ],

  'no-use-before-define': 'off',
  // This seems to have been turned on while previously it had been off
  '@typescript-eslint/no-use-before-define': ['off'],

  /**
   * Restricted imports, e.g. deprecated libraries, etc
   *
   * See: https://eslint.org/docs/rules/no-restricted-imports
   */
  'no-restricted-imports': [
    'error',
    {
      paths: [
        {
          name: 'enzyme',
          message:
            'Please import from `sentry-test/enzyme` instead. See: https://github.com/getsentry/frontend-handbook#undefined-theme-properties-in-tests for more information',
        },
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
          name: 'react-bootstrap',
          message:
            'Avoid usage of any react-bootstrap components as it will soon be removed',
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

  /**
   * Better import sorting
   */
  'sort-imports': 'off',
  'import/order': 'off',
  'simple-import-sort/imports': [
    'error',
    {
      groups: [
        // Side effect imports.
        ['^\\u0000'],

        // Node.js builtins.
        // biome-ignore lint/correctness/noNodejsModules: Need to get the list of things!
        [`^(${require('node:module').builtinModules.join('|')})(/|$)`],

        // Packages. `react` related packages come first.
        ['^react', '^@?\\w'],

        // Test should be separate from the app
        ['^(sentry-test|getsentry-test)(/.*|$)'],

        // Internal packages.
        ['^(sentry-locale|sentry-images)(/.*|$)'],

        ['^(getsentry-images)(/.*|$)'],

        ['^(app|sentry)(/.*|$)'],

        // Getsentry packages.
        ['^(admin|getsentry)(/.*|$)'],

        // Style imports.
        ['^.+\\.less$'],

        // Parent imports. Put `..` last.
        ['^\\.\\.(?!/?$)', '^\\.\\./?$'],

        // Other relative imports. Put same-folder imports and `.` last.
        ['^\\./(?=.*/)(?!/?$)', '^\\.(?!/?$)', '^\\./?$'],
      ],
    },
  ],

  'sentry/no-digits-in-tn': ['error'],

  'sentry/no-dynamic-translations': ['error'],

  // https://github.com/xojs/eslint-config-xo-typescript/blob/9791a067d6a119a21a4db72c02f1da95e25ffbb6/index.js#L95
  '@typescript-eslint/no-restricted-types': [
    'error',
    {
      types: {
        // TODO(scttcper): Turn object on to make our types more strict
        // object: {
        //   message: 'The `object` type is hard to use. Use `Record<string, unknown>` instead. See: https://github.com/typescript-eslint/typescript-eslint/pull/848',
        //   fixWith: 'Record<string, unknown>'
        // },
        Buffer: {
          message:
            'Use Uint8Array instead. See: https://sindresorhus.com/blog/goodbye-nodejs-buffer',
          suggest: ['Uint8Array'],
        },
        '[]': "Don't use the empty array type `[]`. It only allows empty arrays. Use `SomeType[]` instead.",
        '[[]]':
          "Don't use `[[]]`. It only allows an array with a single element which is an empty array. Use `SomeType[][]` instead.",
        '[[[]]]': "Don't use `[[[]]]`. Use `SomeType[][][]` instead.",
      },
    },
  ],
  // TODO(scttcper): Turn no-empty-object-type on to make our types more strict
  // '@typescript-eslint/no-empty-object-type': 'error',
  // TODO(scttcper): Turn no-function on to make our types more strict
  // '@typescript-eslint/no-unsafe-function-type': 'error',
  '@typescript-eslint/no-wrapper-object-types': 'error',

  // Naming convention enforcements
  '@typescript-eslint/naming-convention': [
    'error',
    {
      selector: 'typeLike',
      format: ['PascalCase'],
      leadingUnderscore: 'allow',
    },
    {
      selector: 'enumMember',
      format: ['UPPER_CASE'],
    },
  ],

  // Don't allow lookbehind expressions in regexp as they crash safari
  // We've accidentally used lookbehinds a few times and caused problems.
  'no-lookahead-lookbehind-regexp/no-lookahead-lookbehind-regexp': [
    'error',
    'no-lookbehind',
    'no-negative-lookbehind',
  ],
};

const strictRules = {
  'no-console': ['error'],

  // https://github.com/yannickcr/eslint-plugin-react/blob/master/docs/rules/no-is-mounted.md
  'react/no-is-mounted': ['error'],

  // https://github.com/yannickcr/eslint-plugin-react/blob/master/docs/rules/no-find-dom-node.md
  // Recommended to use callback refs instead
  'react/no-find-dom-node': ['error'],

  // https://github.com/yannickcr/eslint-plugin-react/blob/master/docs/rules/no-string-refs.md
  // This is now considered legacy, callback refs preferred
  'react/no-string-refs': ['error'],

  'jest/no-large-snapshots': ['error', {maxSize: 2000}],

  'sentry/no-styled-shortcut': ['error'],
};

const extendsList = ['sentry-react', 'plugin:import/typescript'];
if (detectDeprecations) {
  extendsList.push('plugin:deprecation/recommended');
}

module.exports = {
  root: true,
  extends: extendsList,

  plugins: [
    '@typescript-eslint',
    '@emotion',
    'import',
    'react',
    'sentry',
    'simple-import-sort',
    'no-lookahead-lookbehind-regexp',
  ],

  parser: '@typescript-eslint/parser',

  parserOptions: detectDeprecations
    ? {
        warnOnUnsupportedTypeScriptVersion: false,
        ecmaVersion: 6,
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
          modules: true,
          legacyDecorators: true,
        },
        project: './tsconfig.json',
      }
    : {
        warnOnUnsupportedTypeScriptVersion: false,
        ecmaVersion: 6,
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
          modules: true,
          legacyDecorators: true,
        },
      },

  env: {
    browser: true,
    es6: true,
    jest: true,
    jquery: true, // hard-loaded into vendor.js
  },

  globals: {
    require: false,
    expect: false,
    MockApiClient: true,
    tick: true,
    jest: true,
  },

  settings: {
    'import/parsers': {
      '@typescript-eslint/parser': ['.ts', '.tsx'],
    },
    'import/resolver': {
      typescript: {},
    },
    'import/extensions': ['.js', '.jsx'],
  },

  rules: {
    ...appRules,
    ...strictRules,
    'react-hooks/rules-of-hooks': 'error',
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
          {
            name: 'qs',
            message: 'Please use query-string instead of qs',
          },
          {
            name: 'moment',
            message: 'Please import moment-timezone instead of moment',
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
      extends: ['plugin:testing-library/react', ...extendsList],
      rules: {
        ...appRules,
        ...strictRules,
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
