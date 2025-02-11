// @ts-check
/**
 * To get started with this ESLint Configuration list be sure to read at least
 * these sections of the docs:
 *  - https://eslint.org/docs/latest/use/configure/configuration-files#specifying-files-and-ignores
 *  - https://eslint.org/docs/latest/use/configure/configuration-files#configuration-objects
 *  - https://eslint.org/docs/latest/use/configure/configuration-files#cascading-configuration-objects
 *
 * This is your friend:
 * `npx eslint --inspect-config`
 */
import * as emotion from '@emotion/eslint-plugin';
import eslint from '@eslint/js';
import prettier from 'eslint-config-prettier';
// @ts-expect-error TS(7016): Could not find a declaration file
import importPlugin from 'eslint-plugin-import';
import jest from 'eslint-plugin-jest';
import jestDom from 'eslint-plugin-jest-dom';
import react from 'eslint-plugin-react';
// @ts-expect-error TS(7016): Could not find a declaration file
import reactHooks from 'eslint-plugin-react-hooks';
// @ts-expect-error TS(7016): Could not find a declaration file
import sentry from 'eslint-plugin-sentry';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import testingLibrary from 'eslint-plugin-testing-library';
// @ts-expect-error TS (7016): Could not find a declaration file
import typescriptSortKeys from 'eslint-plugin-typescript-sort-keys';
import unicorn from 'eslint-plugin-unicorn';
import globals from 'globals';
import invariant from 'invariant';
// biome-ignore lint/correctness/noNodejsModules: Need to get the list of things!
import {builtinModules} from 'node:module';
import typescript from 'typescript-eslint';

invariant(react.configs.flat, 'For typescript');
invariant(react.configs.flat.recommended, 'For typescript');
invariant(react.configs.flat['jsx-runtime'], 'For typescript');

const restrictedImportPatterns = [
  {
    group: ['sentry/components/devtoolbar/*'],
    message: 'Do not depend on toolbar internals',
  },
];

const restrictedImportPaths = [
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
    name: 'react-select',
    message: "Use 'sentry/components/forms/controls/reactSelectWrapper' instead.",
  },
  {
    name: 'sentry/utils/withSentryRouter',
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
];

// Used by both: `languageOptions` & `parserOptions`
const ecmaVersion = 'latest';

export default typescript.config([
  {
    // Main parser & linter options
    // Rules are defined below and inherit these properties
    // https://eslint.org/docs/latest/use/configure/configuration-files#configuration-objects
    name: 'eslint/global/languageOptions',
    languageOptions: {
      ecmaVersion,
      sourceType: 'module',
      globals: {
        // TODO(ryan953): globals.browser seems to have a bug with trailing whitespace
        ...Object.fromEntries(Object.keys(globals.browser).map(k => [k.trim(), false])),
        ...globals.jest,
        MockApiClient: true,
        tick: true,
      },
      parser: typescript.parser,
      parserOptions: {
        ecmaFeatures: {
          globalReturn: false,
        },
        ecmaVersion,

        // https://typescript-eslint.io/packages/parser/#emitdecoratormetadata
        emitDecoratorMetadata: undefined,

        // https://typescript-eslint.io/packages/parser/#experimentaldecorators
        experimentalDecorators: undefined,

        // https://typescript-eslint.io/packages/parser/#jsdocparsingmode
        jsDocParsingMode: process.env.SENTRY_DETECT_DEPRECATIONS ? 'all' : 'none',

        // https://typescript-eslint.io/packages/parser/#project
        project: process.env.SENTRY_DETECT_DEPRECATIONS ? './tsconfig.json' : false,

        // https://typescript-eslint.io/packages/parser/#projectservice
        // `projectService` is recommended, but slower, with our current tsconfig files.
        // projectService: true,
        // tsconfigRootDir: import.meta.dirname,
      },
    },
    linterOptions: {
      noInlineConfig: false,
      reportUnusedDisableDirectives: 'error',
    },
    settings: {
      react: {
        version: '18.2.0',
        defaultVersion: '18.2',
      },
      'import/parsers': {'@typescript-eslint/parser': ['.ts', '.tsx']},
      'import/resolver': {typescript: {}},
      'import/extensions': ['.js', '.jsx'],
    },
  },
  {
    name: 'eslint/global/files',
    // Default file selection
    // https://eslint.org/docs/latest/use/configure/configuration-files#specifying-files-and-ignores
    files: ['**/*.js', '**/*.mjs', '**/*.ts', '**/*.jsx', '**/*.tsx'],
  },
  {
    name: 'eslint/global/ignores',
    // Global ignores
    // https://eslint.org/docs/latest/use/configure/configuration-files#globally-ignoring-files-with-ignores
    ignores: [
      '.devenv/**/*',
      '.github/**/*',
      '.mypy_cache/**/*',
      '.pytest_cache/**/*',
      '.venv/**/*',
      '**/*.benchmark.ts',
      '**/*.d.ts',
      '**/dist/**/*',
      '**/tests/**/fixtures/**/*',
      '**/vendor/**/*',
      'build-utils/**/*',
      'config/chartcuterie/config.js', // TODO: see if this file exists
      'fixtures/artifact_bundle/**/*',
      'fixtures/artifact_bundle_debug_ids/**/*',
      'fixtures/artifact_bundle_duplicated_debug_ids/**/*',
      'fixtures/profiles/embedded.js',
      'jest.config.ts',
      'api-docs/**/*',
      'src/sentry/static/sentry/js/**/*',
      'src/sentry/templates/sentry/**/*',
      'stylelint.config.js',
    ],
  },
  /**
   * Rules are grouped by plugin. If you want to override a specific rule inside
   * the recommended set, then it's recommended to spread the new rule on top
   * of the predefined ones.
   *
   * For example: if you want to enable a new plugin in the codebase and their
   * recommended rules (or a new rule that's part of an existing plugin)
   *
   * 1. First you'd setup a configuration object for that plugin:
   *    {
   *      name: 'my-plugin/recommended',
   *      ...myPlugin.configs.recommended,
   *    },
   *
   * 2. Second you'd override the rule you want to deal with, maybe making it a
   *    warning to start:
   *    {
   *      name: 'my-plugin/recommended',
   *      ...myPlugin.configs.recommended,
   *      rules: {
   *        ['a-rule-outside-the-recommended-list']: 'error',
   *
   *        ...myPlugin.configs.recommended.rules,
   *        ['a-recommended-rule']: 'warn',
   *      }
   *    },
   *
   * 3. Finally, once all warnings are fixed, update from 'warning' to 'error',
   *    or remove the override and rely on the recommended rules again.
   */
  {
    name: 'eslint/rules',
    // https://eslint.org/docs/latest/rules/
    rules: {
      'array-callback-return': 'error',
      'block-scoped-var': 'error',
      'consistent-return': 'error',
      'default-case': 'error',
      'dot-notation': 'error',
      eqeqeq: 'error',
      'guard-for-in': 'off', // TODO(ryan953): Fix violations and enable this rule
      'multiline-comment-style': ['error', 'separate-lines'],
      'no-alert': 'error',
      'no-caller': 'error',
      'no-console': 'error',
      'no-else-return': ['error', {allowElseIf: false}],
      'no-eval': 'error',
      'no-extend-native': 'error',
      'no-extra-bind': 'error',
      'no-floating-decimal': 'error',
      'no-implied-eval': 'error',
      'no-inner-declarations': 'error',
      'no-lone-blocks': 'error',
      'no-loop-func': 'error',
      'no-multi-str': 'error',
      'no-native-reassign': 'error',
      'no-new-func': 'error',
      'no-new-wrappers': 'error',
      'no-new': 'error',
      'no-octal-escape': 'error',
      'no-param-reassign': 'off', // TODO(ryan953): Fix violations and enable this rule
      'no-proto': 'error',
      'no-restricted-imports': [
        'error',
        {patterns: restrictedImportPatterns, paths: restrictedImportPaths},
      ],
      'no-return-assign': 'error',
      'no-script-url': 'error',
      'no-self-compare': 'error',
      'no-sequences': 'error',
      'no-throw-literal': 'error',
      'object-shorthand': ['error', 'properties'],
      radix: 'error',
      'require-await': 'error', // Enabled in favor of @typescript-eslint/require-await, which requires type info
      'spaced-comment': [
        'error',
        'always',
        {
          line: {markers: ['/'], exceptions: ['-', '+']},
          block: {exceptions: ['*'], balanced: true},
        },
      ],
      strict: 'error',
      'vars-on-top': 'off',
      'wrap-iife': ['error', 'any'],
      yoda: 'error',

      // https://github.com/eslint/eslint/blob/main/packages/js/src/configs/eslint-recommended.js
      ...eslint.configs.recommended.rules,
      'no-cond-assign': ['error', 'always'],
      'no-prototype-builtins': 'off',
      'no-useless-escape': 'off',
    },
  },
  {
    // https://github.com/import-js/eslint-plugin-import/tree/main/docs/rules
    ...importPlugin.flatConfigs.recommended,
    name: 'plugin/import',
    rules: {
      'import/newline-after-import': 'error', // https://prettier.io/docs/en/rationale.html#empty-lines
      'import/no-absolute-path': 'error',
      'import/no-amd': 'error',
      'import/no-anonymous-default-export': 'error',
      'import/no-duplicates': 'error',
      'import/no-named-default': 'error',
      'import/no-nodejs-modules': 'error',
      'import/no-webpack-loader-syntax': 'error',

      // https://github.com/import-js/eslint-plugin-import/blob/main/config/recommended.js
      ...importPlugin.flatConfigs.recommended.rules,
      'import/default': 'off', // Disabled in favor of typescript-eslint
      'import/named': 'off', // Disabled in favor of typescript-eslint
      'import/namespace': 'off', // Disabled in favor of typescript-eslint
      'import/no-named-as-default-member': 'off', // Disabled in favor of typescript-eslint
      'import/no-named-as-default': 'off', // TODO(ryan953): Fix violations and enable this rule
      'import/no-unresolved': 'off', // Disabled in favor of typescript-eslint
    },
  },
  {
    name: 'plugin/react',
    // https://github.com/jsx-eslint/eslint-plugin-react/tree/master/docs/rules
    plugins: {
      ...react.configs.flat.recommended.plugins,
      ...react.configs.flat['jsx-runtime'].plugins,
    },
    rules: {
      'react/function-component-definition': 'error',
      'react/jsx-boolean-value': ['error', 'never'],
      'react/jsx-fragments': ['error', 'element'],
      'react/jsx-handler-names': 'off', // TODO(ryan953): Fix violations and enable this rule
      'react/no-did-mount-set-state': 'error',
      'react/no-did-update-set-state': 'error',
      'react/no-redundant-should-component-update': 'error',
      'react/no-typos': 'error',
      'react/self-closing-comp': 'error',
      'react/sort-comp': 'error',

      // https://github.com/jsx-eslint/eslint-plugin-react/blob/master/index.js
      ...react.configs.flat.recommended.rules,
      ...react.configs.flat['jsx-runtime'].rules,
      'react/display-name': 'off', // TODO(ryan953): Fix violations and delete this line
      'react/no-unescaped-entities': 'off',
      'react/no-unknown-property': ['error', {ignore: ['css']}],
      'react/prop-types': 'off', // TODO(ryan953): Fix violations and delete this line
    },
  },
  {
    name: 'plugin/react-hooks',
    // https://github.com/facebook/react/tree/main/packages/eslint-plugin-react-hooks
    plugins: {'react-hooks': reactHooks},
    rules: {
      'react-hooks/exhaustive-deps': [
        'error',
        {additionalHooks: '(useEffectAfterFirstRender|useMemoWithPrevious)'},
      ],
      'react-hooks/rules-of-hooks': 'error',
    },
  },
  {
    name: 'plugin/typescript-eslint/custom',
    rules: {
      'no-shadow': 'off', // Disabled in favor of @typescript-eslint/no-shadow
      'no-use-before-define': 'off', // See also @typescript-eslint/no-use-before-define

      '@typescript-eslint/naming-convention': [
        'error',
        {selector: 'typeLike', format: ['PascalCase'], leadingUnderscore: 'allow'},
        {selector: 'enumMember', format: ['UPPER_CASE']},
      ],

      '@typescript-eslint/no-restricted-types': [
        'error',
        {
          types: {
            object: {
              message:
                'The `object` type is hard to use. Use `Record<PropertyKey, unknown>` instead. See: https://github.com/typescript-eslint/typescript-eslint/pull/848',
              fixWith: 'Record<PropertyKey, unknown>',
            },
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
      '@typescript-eslint/no-shadow': 'error',
      '@typescript-eslint/no-use-before-define': 'off', // Enabling this will cause a lot of thrash to the git history
      '@typescript-eslint/no-useless-empty-export': 'error',
    },
  },
  // https://github.com/typescript-eslint/typescript-eslint/blob/main/packages/eslint-plugin/src/configs/base.ts
  // https://github.com/typescript-eslint/typescript-eslint/blob/main/packages/eslint-plugin/src/configs/eslint-recommended-raw.ts
  // https://github.com/typescript-eslint/typescript-eslint/blob/main/packages/eslint-plugin/src/configs/recommended.ts
  // https://github.com/typescript-eslint/typescript-eslint/blob/main/packages/eslint-plugin/src/configs/strict.ts
  // https://github.com/typescript-eslint/typescript-eslint/blob/main/packages/eslint-plugin/src/configs/stylistic.ts
  ...typescript.configs.strict.map(c => ({...c, name: `plugin/${c.name}`})),
  ...typescript.configs.stylistic.map(c => ({...c, name: `plugin/${c.name}`})),
  {
    name: 'plugin/typescript-eslint/overrides',
    // https://typescript-eslint.io/rules/
    plugins: {'@typescript-eslint': typescript.plugin},
    rules: {
      'prefer-spread': 'off',
      '@typescript-eslint/prefer-enum-initializers': 'error',

      // Recommended overrides
      '@typescript-eslint/no-empty-object-type': 'off', // TODO(ryan953): Fix violations and delete this line
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-namespace': 'off',
      '@typescript-eslint/no-non-null-asserted-optional-chain': 'off', // TODO(ryan953): Fix violations and delete this line
      '@typescript-eslint/no-require-imports': 'off', // TODO(ryan953): Fix violations and delete this line
      '@typescript-eslint/no-this-alias': 'off', // TODO(ryan953): Fix violations and delete this line
      '@typescript-eslint/no-unsafe-function-type': 'off', // TODO(ryan953): Fix violations and delete this line

      // Strict overrides
      '@typescript-eslint/no-dynamic-delete': 'off', // TODO(ryan953): Fix violations and delete this line
      '@typescript-eslint/no-invalid-void-type': 'off', // TODO(ryan953): Fix violations and delete this line
      '@typescript-eslint/no-non-null-assertion': 'off', // TODO(ryan953): Fix violations and delete this line
      '@typescript-eslint/unified-signatures': 'off',

      // Stylistic overrides
      '@typescript-eslint/array-type': ['error', {default: 'array-simple'}],
      '@typescript-eslint/class-literal-property-style': 'off', // TODO(ryan953): Fix violations and delete this line
      '@typescript-eslint/consistent-generic-constructors': 'off', // TODO(ryan953): Fix violations and delete this line
      '@typescript-eslint/consistent-indexed-object-style': 'off', // TODO(ryan953): Fix violations and delete this line
      '@typescript-eslint/consistent-type-definitions': 'off', // TODO(ryan953): Fix violations and delete this line
      '@typescript-eslint/no-empty-function': 'off', // TODO(ryan953): Fix violations and delete this line
      '@typescript-eslint/no-inferrable-types': 'off', // TODO(ryan953): Fix violations and delete this line

      // Customization
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
    },
  },
  {
    name: 'plugin/typescript-eslint/process.env.SENTRY_DETECT_DEPRECATIONS=1',
    rules: {
      '@typescript-eslint/no-deprecated': process.env.SENTRY_DETECT_DEPRECATIONS
        ? 'error'
        : 'off',
    },
  },
  {
    name: 'plugin/typescript-sort-keys',
    // https://github.com/infctr/eslint-plugin-typescript-sort-keys
    plugins: {'typescript-sort-keys': typescriptSortKeys},
    rules: {
      'typescript-sort-keys/interface': [
        'error',
        'asc',
        {caseSensitive: true, natural: false, requiredFirst: true},
      ],
    },
  },
  {
    name: 'plugin/simple-import-sort',
    // https://github.com/lydell/eslint-plugin-simple-import-sort
    plugins: {'simple-import-sort': simpleImportSort},
    rules: {
      'import/order': 'off',
      'sort-imports': 'off',
      'simple-import-sort/imports': [
        'error',
        {
          groups: [
            // Side effect imports.
            [String.raw`^\u0000`],

            // Node.js builtins.
            [`^(${builtinModules.join('|')})(/|$)`],

            // Packages. `react` related packages come first.
            ['^react', String.raw`^@?\w`],

            // Test should be separate from the app
            ['^(sentry-test|getsentry-test)(/.*|$)'],

            // Internal packages.
            ['^(sentry-locale|sentry-images)(/.*|$)'],

            ['^(getsentry-images)(/.*|$)'],

            ['^(app|sentry)(/.*|$)'],

            // Getsentry packages.
            ['^(admin|getsentry)(/.*|$)'],

            // Style imports.
            [String.raw`^.+\.less$`],

            // Parent imports. Put `..` last.
            [String.raw`^\.\.(?!/?$)`, String.raw`^\.\./?$`],

            // Other relative imports. Put same-folder imports and `.` last.
            [String.raw`^\./(?=.*/)(?!/?$)`, String.raw`^\.(?!/?$)`, String.raw`^\./?$`],
          ],
        },
      ],
    },
  },
  {
    name: 'plugin/sentry',
    // https://github.com/getsentry/eslint-config-sentry/tree/master/packages/eslint-plugin-sentry/docs/rules
    plugins: {sentry},
    rules: {
      'sentry/no-digits-in-tn': 'error',
      'sentry/no-dynamic-translations': 'error', // TODO(ryan953): There are no docs for this rule
      'sentry/no-styled-shortcut': 'error',
    },
  },
  {
    name: 'plugin/@emotion',
    // https://github.com/emotion-js/emotion/tree/main/packages/eslint-plugin/docs/rules
    plugins: {'@emotion': emotion},
    rules: {
      '@emotion/import-from-emotion': 'off', // Not needed, in v11 we import from @emotion/react
      '@emotion/jsx-import': 'off', // Not needed, handled by babel
      '@emotion/no-vanilla': 'error',
      '@emotion/pkg-renaming': 'off', // Not needed, we have migrated to v11 and the old package names cannot be used anymore
      '@emotion/styled-import': 'error',
      '@emotion/syntax-preference': ['error', 'string'],
    },
  },
  {
    name: 'plugin/unicorn',
    plugins: {unicorn},
    rules: {
      // The recommended rules are very opinionated. We don't need to enable them.

      'unicorn/no-instanceof-array': 'error',
      'unicorn/prefer-array-flat-map': 'error',
      'unicorn/prefer-node-protocol': 'error',
    },
  },
  {
    name: 'plugin/jest',
    files: ['**/*.spec.{ts,js,tsx,jsx}', 'tests/js/**/*.{ts,js,tsx,jsx}'],
    // https://github.com/jest-community/eslint-plugin-jest/tree/main/docs/rules
    plugins: jest.configs['flat/recommended'].plugins,
    rules: {
      'jest/max-nested-describe': 'error',
      'jest/no-duplicate-hooks': 'error',
      'jest/no-large-snapshots': ['error', {maxSize: 2000}], // We don't recommend snapshots, but if there are any keep it small

      // https://github.com/jest-community/eslint-plugin-jest/blob/main/src/index.ts
      ...jest.configs['flat/recommended'].rules,
      ...jest.configs['flat/style'].rules,

      'jest/expect-expect': 'off', // Disabled as we have many tests which render as simple validations
      'jest/no-conditional-expect': 'off', // TODO(ryan953): Fix violations then delete this line
      'jest/no-disabled-tests': 'error', // `recommended` set this to warn, we've upgraded to error
    },
  },
  {
    name: 'plugin/jest-dom',
    files: ['**/*.spec.{ts,js,tsx,jsx}', 'tests/js/**/*.{ts,js,tsx,jsx}'],
    // https://github.com/testing-library/eslint-plugin-jest-dom/tree/main?tab=readme-ov-file#supported-rules
    ...jestDom.configs['flat/recommended'],
  },
  {
    name: 'plugin/testing-library',
    files: ['**/*.spec.{ts,js,tsx,jsx}', 'tests/js/**/*.{ts,js,tsx,jsx}'],
    // https://github.com/testing-library/eslint-plugin-testing-library/tree/main/docs/rules
    ...testingLibrary.configs['flat/react'],
    rules: {
      // https://github.com/testing-library/eslint-plugin-testing-library/blob/main/lib/configs/react.ts
      ...testingLibrary.configs['flat/react'].rules,
      'testing-library/no-unnecessary-act': 'off',
      'testing-library/render-result-naming-convention': 'off',
    },
  },
  {
    name: 'plugin/prettier',
    ...prettier,
  },
  {
    name: 'files/*.config.*',
    files: ['**/*.config.*'],
    languageOptions: {
      globals: {
        ...globals.commonjs,
        ...globals.node,
      },
    },

    rules: {
      'import/no-nodejs-modules': 'off',
    },
  },
  {
    name: 'files/scripts',
    files: ['scripts/**/*.{js,ts}', 'tests/js/test-balancer/index.js'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: {
        ...globals.commonjs,
        ...globals.node,
      },
    },
    rules: {
      'no-console': 'off',

      'import/no-nodejs-modules': 'off',
    },
  },
  {
    name: 'files/jest related',
    files: [
      'tests/js/jest-pegjs-transform.js',
      'tests/js/sentry-test/echartsMock.js',
      'tests/js/sentry-test/importStyleMock.js',
      'tests/js/sentry-test/loadFixtures.ts',
      'tests/js/sentry-test/svgMock.js',
      'tests/js/setup.ts',
    ],
    languageOptions: {
      sourceType: 'commonjs',
      globals: {
        ...globals.commonjs,
      },
    },
    rules: {
      'import/no-nodejs-modules': 'off',
    },
  },
  {
    name: 'files/devtoolbar',
    files: ['static/app/components/devtoolbar/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            ...restrictedImportPaths,
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
    name: 'files/sentry-test',
    files: ['**/*.spec.{ts,js,tsx,jsx}', 'tests/js/**/*.{ts,js,tsx,jsx}'],
    rules: {
      'no-loss-of-precision': 'off', // Sometimes we have wild numbers hard-coded in tests
      'no-restricted-imports': [
        'error',
        {
          patterns: restrictedImportPatterns,
          paths: [
            ...restrictedImportPaths,
            {
              name: 'sentry/locale',
              message: 'Translations are not needed in tests.',
            },
          ],
        },
      ],
    },
  },
  {
    name: 'files/sentry-stories',
    files: ['**/*.stories.tsx'],
    rules: {
      'no-loss-of-precision': 'off', // Sometimes we have wild numbers hard-coded in stories
    },
  },
  {
    // We specify rules explicitly for the sdk-loader here so we do not have
    // eslint ignore comments included in the source file, which is consumed
    // by users.
    name: 'files/js-sdk-loader.ts',
    files: ['**/js-sdk-loader.ts'],
    rules: {
      'no-console': 'off',
    },
  },
]);
