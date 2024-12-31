// @ts-check
/**
 * Understanding & making changes to this file:
 *
 * This is your friend:
 * `npx eslint --inspect-config`
 */
import * as emotion from '@emotion/eslint-plugin';
import {fixupPluginRules} from '@eslint/compat';
import importPlugin from 'eslint-plugin-import';
import jest from 'eslint-plugin-jest';
import jestDom from 'eslint-plugin-jest-dom';
import prettier from 'eslint-plugin-prettier/recommended';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import sentry from 'eslint-plugin-sentry';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import testingLibrary from 'eslint-plugin-testing-library';
import typescriptSortKeys from 'eslint-plugin-typescript-sort-keys';
import globals from 'globals';
import invariant from 'invariant';
// biome-ignore lint/correctness/noNodejsModules: Need to get the list of things!
import {builtinModules} from 'node:module';
import typescript from 'typescript-eslint';

invariant(react.configs.flat, 'For typescript');

const baseRules = {
  /**
   * Strict mode
   */
  // https://eslint.org/docs/rules/strict
  strict: ['error', 'global'],

  /**
   * Variables
   */
  // https://eslint.org/docs/rules/no-shadow-restricted-names
  'no-shadow-restricted-names': ['error'],

  /**
   * Possible errors
   */
  // https://eslint.org/docs/rules/no-cond-assign
  'no-cond-assign': ['error', 'always'],

  // https://eslint.org/docs/rules/no-alert
  'no-alert': ['error'],

  // https://eslint.org/docs/rules/no-constant-condition
  'no-constant-condition': ['warn'],

  // https://eslint.org/docs/rules/no-empty
  'no-empty': ['error'],

  // https://eslint.org/docs/rules/no-ex-assign
  'no-ex-assign': ['error'],

  // https://eslint.org/docs/rules/no-extra-boolean-cast
  'no-extra-boolean-cast': ['error'],

  // https://eslint.org/docs/rules/no-func-assign
  'no-func-assign': ['error'],

  // https://eslint.org/docs/rules/no-inner-declarations
  'no-inner-declarations': ['error'],

  // https://eslint.org/docs/rules/no-invalid-regexp
  'no-invalid-regexp': ['error'],

  // https://eslint.org/docs/rules/no-irregular-whitespace
  'no-irregular-whitespace': ['error'],

  // https://eslint.org/docs/rules/no-obj-calls
  'no-obj-calls': ['error'],

  // https://eslint.org/docs/rules/no-sparse-arrays
  'no-sparse-arrays': ['error'],

  // https://eslint.org/docs/rules/block-scoped-var
  'block-scoped-var': ['error'],

  /**
   * Best practices
   */
  // https://eslint.org/docs/rules/consistent-return
  'consistent-return': ['error'],

  // https://eslint.org/docs/rules/default-case
  'default-case': ['error'],

  // https://eslint.org/docs/rules/dot-notation
  'dot-notation': [
    'error',
    {
      allowKeywords: true,
    },
  ],

  // https://eslint.org/docs/rules/guard-for-in [REVISIT ME]
  'guard-for-in': ['off'],

  // https://eslint.org/docs/rules/no-caller
  'no-caller': ['error'],

  // https://eslint.org/docs/rules/no-eval
  'no-eval': ['error'],

  // https://eslint.org/docs/rules/no-extend-native
  'no-extend-native': ['error'],

  // https://eslint.org/docs/rules/no-extra-bind
  'no-extra-bind': ['error'],

  // https://eslint.org/docs/rules/no-fallthrough
  'no-fallthrough': ['error'],

  // https://eslint.org/docs/rules/no-floating-decimal
  'no-floating-decimal': ['error'],

  // https://eslint.org/docs/rules/no-implied-eval
  'no-implied-eval': ['error'],

  // https://eslint.org/docs/rules/no-lone-blocks
  'no-lone-blocks': ['error'],

  // https://eslint.org/docs/rules/no-loop-func
  'no-loop-func': ['error'],

  // https://eslint.org/docs/rules/no-multi-str
  'no-multi-str': ['error'],

  // https://eslint.org/docs/rules/no-native-reassign
  'no-native-reassign': ['error'],

  // https://eslint.org/docs/rules/no-new
  'no-new': ['error'],

  // https://eslint.org/docs/rules/no-new-func
  'no-new-func': ['error'],

  // https://eslint.org/docs/rules/no-new-wrappers
  'no-new-wrappers': ['error'],

  // https://eslint.org/docs/rules/no-octal
  'no-octal': ['error'],

  // https://eslint.org/docs/rules/no-octal-escape
  'no-octal-escape': ['error'],

  // https://eslint.org/docs/rules/no-param-reassign [REVISIT ME]
  'no-param-reassign': ['off'],

  // https://eslint.org/docs/rules/no-proto
  'no-proto': ['error'],

  // https://eslint.org/docs/rules/no-return-assign
  'no-return-assign': ['error'],

  // https://eslint.org/docs/rules/no-script-url
  'no-script-url': ['error'],

  // https://eslint.org/docs/rules/no-self-compare
  'no-self-compare': ['error'],

  // https://eslint.org/docs/rules/no-sequences
  'no-sequences': ['error'],

  // https://eslint.org/docs/rules/no-throw-literal
  'no-throw-literal': ['error'],

  // https://eslint.org/docs/rules/no-with
  'no-with': ['error'],

  // https://eslint.org/docs/rules/radix
  radix: ['error'],

  // https://eslint.org/docs/rules/object-shorthand
  'object-shorthand': ['error', 'properties'],

  // https://eslint.org/docs/rules/vars-on-top
  'vars-on-top': ['off'],

  // https://eslint.org/docs/rules/wrap-iife
  'wrap-iife': ['error', 'any'],

  // https://eslint.org/docs/rules/array-callback-return
  'array-callback-return': ['error'],

  // https://eslint.org/docs/rules/yoda
  yoda: ['error'],

  // https://eslint.org/docs/rules/no-else-return
  'no-else-return': ['error', {allowElseIf: false}],

  // https://eslint.org/docs/rules/require-await
  'require-await': ['error'],

  // https://eslint.org/docs/rules/multiline-comment-style
  'multiline-comment-style': ['error', 'separate-lines'],

  // https://eslint.org/docs/rules/spaced-comment
  'spaced-comment': [
    'error',
    'always',
    {
      line: {markers: ['/'], exceptions: ['-', '+']},
      block: {exceptions: ['*'], balanced: true},
    },
  ],
};

const reactReactRules = {
  // https://github.com/yannickcr/eslint-plugin-react/blob/master/docs/rules/display-name.md
  'react/display-name': ['off'],

  // https://github.com/yannickcr/eslint-plugin-react/blob/master/docs/rules/no-multi-comp.md
  'react/no-multi-comp': [
    'off',
    {
      ignoreStateless: true,
    },
  ],

  // https://github.com/yannickcr/eslint-plugin-react/blob/master/docs/rules/jsx-fragments.md
  'react/jsx-fragments': ['error', 'element'],

  // https://github.com/yannickcr/eslint-plugin-react/blob/master/docs/rules/jsx-handler-names.md
  // Ensures that any component or prop methods used to handle events are correctly prefixed.
  'react/jsx-handler-names': [
    'off',
    {
      eventHandlerPrefix: 'handle',
      eventHandlerPropPrefix: 'on',
    },
  ],

  // https://github.com/yannickcr/eslint-plugin-react/blob/master/docs/rules/jsx-key.md
  'react/jsx-key': ['error'],

  // https://github.com/yannickcr/eslint-plugin-react/blob/master/docs/rules/jsx-no-undef.md
  'react/jsx-no-undef': ['error'],

  // Disabled as we use the newer JSX transform babel plugin.
  // https://github.com/yannickcr/eslint-plugin-react/blob/master/docs/rules/jsx-uses-react.md
  'react/jsx-uses-react': ['off'],

  // https://github.com/yannickcr/eslint-plugin-react/blob/master/docs/rules/jsx-uses-vars.md
  'react/jsx-uses-vars': ['error'],

  /**
   * Deprecation related rules
   */
  // https://github.com/yannickcr/eslint-plugin-react/blob/master/docs/rules/no-deprecated.md
  'react/no-deprecated': ['error'],

  // Prevent usage of the return value of React.render
  // deprecation: https://facebook.github.io/react/docs/react-dom.html#render
  // https://github.com/yannickcr/eslint-plugin-react/blob/master/docs/rules/no-render-return-value.md
  'react/no-render-return-value': ['error'],

  // Children should always be actual children, not passed in as a prop.
  // When using JSX, the children should be nested between the opening and closing tags. When not using JSX, the children should be passed as additional arguments to React.createElement.
  // https://github.com/yannickcr/eslint-plugin-react/blob/master/docs/rules/no-children-prop.md
  'react/no-children-prop': ['error'],

  // This rule helps prevent problems caused by using children and the dangerouslySetInnerHTML prop at the same time.
  // React will throw a warning if this rule is ignored.
  // https://github.com/yannickcr/eslint-plugin-react/blob/master/docs/rules/no-danger-with-children.md
  'react/no-danger-with-children': ['error'],

  // Prevent direct mutation of this.state
  // https://github.com/yannickcr/eslint-plugin-react/blob/master/docs/rules/no-direct-mutation-state.md
  'react/no-direct-mutation-state': ['error'],

  // https://github.com/yannickcr/eslint-plugin-react/blob/master/docs/rules/no-did-mount-set-state.md
  'react/no-did-mount-set-state': ['error'],

  // https://github.com/yannickcr/eslint-plugin-react/blob/master/docs/rules/no-did-update-set-state.md"
  'react/no-did-update-set-state': ['error'],

  // https://github.com/yannickcr/eslint-plugin-react/blob/master/docs/rules/no-redundant-should-component-update.md
  'react/no-redundant-should-component-update': ['error'],

  // https://github.com/yannickcr/eslint-plugin-react/blob/master/docs/rules/no-typos.md
  'react/no-typos': ['error'],

  // Prevent invalid characters from appearing in markup
  // https://github.com/yannickcr/eslint-plugin-react/blob/master/docs/rules/no-unescaped-entities.md
  'react/no-unescaped-entities': ['off'],

  // https://github.com/yannickcr/eslint-plugin-react/blob/master/docs/rules/no-unknown-property.md
  'react/no-unknown-property': ['error', {ignore: ['css']}],

  // https://github.com/yannickcr/eslint-plugin-react/blob/master/docs/rules/no-unused-prop-types.md
  // Disabled since this currently fails to correctly detect a lot of
  // typescript prop type usage.
  'react/no-unused-prop-types': ['off'],

  // We do not need proptypes since we're using typescript
  'react/prop-types': ['off'],

  // When writing the render method in a component it is easy to forget to return the JSX content.
  // This rule will warn if the return statement is missing.
  // https://github.com/yannickcr/eslint-plugin-react/blob/master/docs/rules/require-render-return.md
  'react/require-render-return': ['error'],

  // Disabled as we are using the newer JSX transform babel plugin.
  // https://github.com/yannickcr/eslint-plugin-react/blob/master/docs/rules/react-in-jsx-scope.md
  'react/react-in-jsx-scope': ['off'],

  // https://github.com/yannickcr/eslint-plugin-react/blob/master/docs/rules/self-closing-comp.md
  'react/self-closing-comp': ['error'],

  // This also causes issues with typescript
  // See: https://github.com/yannickcr/eslint-plugin-react/issues/2066
  //
  // https://github.com/yannickcr/eslint-plugin-react/blob/master/docs/rules/sort-comp.md
  'react/sort-comp': ['warn'],

  // Consistent <Component booleanProp /> (never add ={true})
  // https://github.com/yannickcr/eslint-plugin-react/blob/master/docs/rules/jsx-boolean-value.md
  'react/jsx-boolean-value': ['error', 'never'],

  // Consistent function component declaration styles
  // https://github.com/jsx-eslint/eslint-plugin-react/blob/master/docs/rules/function-component-definition.md
  'react/function-component-definition': [
    'error',
    {namedComponents: 'function-declaration'},
  ],
};

const reactImportRules = {
  // Not recommended to be enabled with typescript-eslint
  // https://typescript-eslint.io/linting/troubleshooting/performance-troubleshooting/#eslint-plugin-import
  'import/no-unresolved': ['off'],
  'import/named': ['off'],
  'import/default': ['off'],
  'import/export': ['off'],
  'import/no-named-as-default-member': ['off'],

  // Redflags
  // do not allow a default import name to match a named export (airbnb: error)
  // Issue with `DefaultIssuePlugin` and `app/plugins/index`
  // https://github.com/benmosher/eslint-plugin-import/blob/master/docs/rules/no-named-as-default.md
  'import/no-named-as-default': ['off'],

  // disallow use of jsdoc-marked-deprecated imports
  // https://github.com/benmosher/eslint-plugin-import/blob/master/docs/rules/no-deprecated.md
  'import/no-deprecated': ['off'],

  // Forbid mutable exports (airbnb: error)
  // https://github.com/benmosher/eslint-plugin-import/blob/master/docs/rules/no-mutable-exports.md
  // TODO: enable?
  'import/no-mutable-exports': ['off'],

  // disallow require()
  // https://github.com/benmosher/eslint-plugin-import/blob/master/docs/rules/no-commonjs.md
  'import/no-commonjs': ['off'],

  // disallow AMD require/define
  // https://github.com/benmosher/eslint-plugin-import/blob/master/docs/rules/no-amd.md
  'import/no-amd': ['error'],

  // disallow duplicate imports
  // https://github.com/benmosher/eslint-plugin-import/blob/master/docs/rules/no-duplicates.md
  'import/no-duplicates': ['error'],

  // disallow namespace imports
  // https://github.com/benmosher/eslint-plugin-import/blob/master/docs/rules/no-namespace.md
  'import/no-namespace': ['off'],

  // Ensure consistent use of file extension within the import path
  // https://github.com/benmosher/eslint-plugin-import/blob/master/docs/rules/extensions.md
  // TODO this fucks up getsentry
  'import/extensions': [
    'off',
    'always',
    {
      js: 'never',
      jsx: 'never',
    },
  ],

  // Require a newline after the last import/require in a group
  // https://github.com/benmosher/eslint-plugin-import/blob/master/docs/rules/newline-after-import.md
  'import/newline-after-import': ['error'],

  // Require modules with a single export to use a default export (airbnb: error)
  // https://github.com/benmosher/eslint-plugin-import/blob/master/docs/rules/prefer-default-export.md
  'import/prefer-default-export': ['off'],

  // Restrict which files can be imported in a given folder
  // https://github.com/benmosher/eslint-plugin-import/blob/master/docs/rules/no-restricted-paths.md
  'import/no-restricted-paths': ['off'],

  // Forbid modules to have too many dependencies
  // https://github.com/benmosher/eslint-plugin-import/blob/master/docs/rules/max-dependencies.md
  'import/max-dependencies': ['off', {max: 10}],

  // Forbid import of modules using absolute paths
  // https://github.com/benmosher/eslint-plugin-import/blob/master/docs/rules/no-absolute-path.md
  'import/no-absolute-path': ['error'],

  // Forbid require() calls with expressions (airbnb: error)
  // https://github.com/benmosher/eslint-plugin-import/blob/master/docs/rules/no-dynamic-require.md
  'import/no-dynamic-require': ['off'],

  // Use webpack default chunk names
  'import/dynamic-import-chunkname': ['off'],

  // prevent importing the submodules of other modules
  // https://github.com/benmosher/eslint-plugin-import/blob/master/docs/rules/no-internal-modules.md
  'import/no-internal-modules': [
    'off',
    {
      allow: [],
    },
  ],

  // Warn if a module could be mistakenly parsed as a script by a consumer
  // leveraging Unambiguous JavaScript Grammar
  // https://github.com/benmosher/eslint-plugin-import/blob/master/docs/rules/unambiguous.md
  // this should not be enabled until this proposal has at least been *presented* to TC39.
  // At the moment, it"s not a thing.
  'import/unambiguous': ['off'],

  // Forbid Webpack loader syntax in imports
  // https://github.com/benmosher/eslint-plugin-import/blob/master/docs/rules/no-webpack-loader-syntax.md
  'import/no-webpack-loader-syntax': ['error'],

  // Prevent unassigned imports
  // https://github.com/benmosher/eslint-plugin-import/blob/master/docs/rules/no-unassigned-import.md
  // importing for side effects is perfectly acceptable, if you need side effects.
  'import/no-unassigned-import': ['off'],

  // Prevent importing the default as if it were named
  // https://github.com/benmosher/eslint-plugin-import/blob/master/docs/rules/no-named-default.md
  'import/no-named-default': ['error'],

  // Reports if a module"s default export is unnamed
  // https://github.com/benmosher/eslint-plugin-import/blob/d9b712ac7fd1fddc391f7b234827925c160d956f/docs/rules/no-anonymous-default-export.md
  'import/no-anonymous-default-export': [
    'error',
    {
      allowArray: false,
      allowArrowFunction: false,
      allowAnonymousClass: false,
      allowAnonymousFunction: false,
      allowCallExpression: true,
      allowLiteral: false,
      allowObject: false,
    },
  ],
};

const reactRules = {
  ...reactReactRules,
  ...reactImportRules,
  /**
   * React hooks
   */
  'react-hooks/exhaustive-deps': [
    'error',
    {additionalHooks: '(useEffectAfterFirstRender|useMemoWithPrevious)'},
  ],
  // Biome not yet enforcing all parts of this rule https://github.com/biomejs/biome/issues/1984
  'react-hooks/rules-of-hooks': 'error',

  /**
   * Custom
   */
  // highlights literals in JSX components w/o translation tags
  'getsentry/jsx-needs-il8n': ['off'],

  'typescript-sort-keys/interface': [
    'error',
    'asc',
    {caseSensitive: true, natural: false, requiredFirst: true},
  ],
};

const appRules = {
  // no-undef is redundant with typescript as tsc will complain
  // A downside is that we won't get eslint errors about it, but your editors should
  // support tsc errors so....
  // https://eslint.org/docs/rules/no-undef
  'no-undef': 'off',

  // Let formatter handle this
  'arrow-body-style': 'off',

  /**
   * Need to use typescript version of these rules
   * https://eslint.org/docs/rules/no-shadow
   */
  'no-shadow': 'off',
  '@typescript-eslint/no-shadow': 'error',

  // This only override the `args` rule (which is "none"). There are too many errors and it's difficult to manually
  // fix them all, so we'll have to incrementally update.
  // https://eslint.org/docs/rules/no-unused-vars
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

  // https://eslint.org/docs/rules/no-use-before-define
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
      patterns: [
        {
          group: ['sentry/components/devtoolbar/*'],
          message: 'Do not depend on toolbar internals',
        },
        {
          group: ['*.spec*'],
          message:
            'Do not import from test files. This causes tests to be executed multiple times.',
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
        [`^(${builtinModules.join('|')})(/|$)`],

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
};

const strictRules = {
  // https://eslint.org/docs/rules/no-console
  'no-console': ['error'],

  // https://github.com/yannickcr/eslint-plugin-react/blob/master/docs/rules/no-is-mounted.md
  'react/no-is-mounted': ['error'],

  // https://github.com/yannickcr/eslint-plugin-react/blob/master/docs/rules/no-find-dom-node.md
  // Recommended to use callback refs instead
  'react/no-find-dom-node': ['error'],

  // https://github.com/yannickcr/eslint-plugin-react/blob/master/docs/rules/no-string-refs.md
  // This is now considered legacy, callback refs preferred
  'react/no-string-refs': ['error'],

  'sentry/no-styled-shortcut': ['error'],
};

// Used by both: `languageOptions` & `parserOptions`
const ecmaVersion = 6; // TODO(ryan953): change to 'latest'

/**
 * To get started with this ESLint Configuration list be sure to read at least
 * these sections of the docs:
 *  - https://eslint.org/docs/latest/use/configure/configuration-files#specifying-files-and-ignores
 *  - https://eslint.org/docs/latest/use/configure/configuration-files#cascading-configuration-objects
 */

export default typescript.config([
  {
    // Main parser & linter options
    // Rules are defined below and inherit these properties
    // https://eslint.org/docs/latest/use/configure/configuration-files#configuration-objects
    name: 'main',
    languageOptions: {
      ecmaVersion,
      sourceType: 'module',
      globals: {
        // TODO(ryan953): globals.browser seems to have a bug with trailing whitespace
        ...Object.fromEntries(
          Object.keys(globals.browser).map(key => [key.trim(), false])
        ),
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
        project: './tsconfig.json',

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
    // TODO: move these potential overrides and plugin-specific rules into the
    // corresponding configuration object where the plugin is initially included
    plugins: {
      ...react.configs.flat.plugins,
      ...react.configs.flat['jsx-runtime'].plugins,
      '@typescript-eslint': typescript.plugin,
      'react-hooks': fixupPluginRules(reactHooks),
      'simple-import-sort': simpleImportSort,
      'typescript-sort-keys': typescriptSortKeys,
      sentry,
    },
    settings: {
      react: {
        version: '18.2.0',
        defaultVersion: '18.2',
      },
      'import/parsers': {
        '@typescript-eslint/parser': ['.ts', '.tsx'],
      },
      'import/resolver': {
        typescript: {},
      },
      'import/extensions': ['.js', '.jsx'],
    },
  },
  {
    // Default file selection
    // https://eslint.org/docs/latest/use/configure/configuration-files#specifying-files-and-ignores
    files: ['**/*.js', '**/*.mjs', '**/*.ts', '**/*.jsx', '**/*.tsx'],
  },
  {
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
   * Global Rules
   * Any ruleset that does not include `files` or `ignores` fields
   *
   * Plugins are configured within each configuration object.
   * https://eslint.org/docs/latest/use/configure/configuration-files#configuration-objects
   *
   * Rules are grouped by plugin. If you want to override a specific rule inside
   * the recommended set, then it's recommended to spread the new rule on top
   * of the predefined ones.
   *
   * For example: if you want to enable a new plugin in the codebase and their
   * recommended rules (or a new rule that's part of an existing plugin)
   * First you'd setup a configuration object for that plugin:
   * {
   *   name: 'my-plugin/recommended',
   *   ...myPlugin.configs.recommended,
   * },
   * Second you'd override the rule you want to deal with, maybe making it a
   * warning to start:
   * {
   *   name: 'my-plugin/recommended',
   *   ...myPlugin.configs.recommended,
   *   rules: {
   *     ...myPlugin.configs.recommended.rules,
   *     ['the-rule']: 'warning',
   *   }
   * },
   * Finally, once all warnings are fixed, update from 'warning' to 'error', or
   * remove the override and rely on the recommended rules again.
   */
  {
    name: 'import/recommended',
    ...importPlugin.flatConfigs.recommended,
  },
  {
    name: 'deprecations',
    rules: {
      '@typescript-eslint/no-deprecated': process.env.SENTRY_DETECT_DEPRECATIONS
        ? 'error'
        : 'off',
    },
  },
  {
    name: 'getsentry/sentry/custom',
    rules: {
      ...baseRules,
      ...reactRules,
      ...appRules,
      ...strictRules,
    },
  },
  {
    name: '@emotion',
    plugins: {
      '@emotion': emotion,
    },
    rules: {
      '@emotion/import-from-emotion': 'off', // Not needed, in v11 we import from @emotion/react
      '@emotion/jsx-import': 'off', // Not needed, handled by babel
      '@emotion/no-vanilla': 'error',
      '@emotion/pkg-renaming': 'off', // Not needed, we have migrated to v11 and the old package names cannot be used anymore
      '@emotion/styled-import': 'error',
      '@emotion/syntax-preference': ['off', 'string'], // TODO(ryan953): Enable this so `css={css``}` is required
    },
  },
  {
    name: 'devtoolbar',
    files: ['static/app/components/devtoolbar/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            // @ts-ignore
            ...appRules['no-restricted-imports'][1].paths,
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
    name: 'jest',
    files: ['**/*.spec.{ts,js,tsx,jsx}', 'tests/js/**/*.{ts,js,tsx,jsx}'],
    plugins: jest.configs['flat/recommended'].plugins,
    rules: {
      'jest/no-disabled-tests': 'error',

      // Disabled as we have many tests which render as simple validations
      'jest/expect-expect': 'off',

      // Disabled as we have some comment out tests that cannot be
      // uncommented due to typescript errors.
      'jest/no-commented-out-tests': 'off',

      // Disabled as we do sometimes have conditional expects
      'jest/no-conditional-expect': 'off',

      // Useful for exporting some test utilities
      'jest/no-export': 'off',

      // We don't recommend snapshots, but if there are any keep it small
      'jest/no-large-snapshots': ['error', {maxSize: 2000}],
    },
  },
  {
    name: 'jest-dom',
    files: ['**/*.spec.{ts,js,tsx,jsx}', 'tests/js/**/*.{ts,js,tsx,jsx}'],
    plugins: jestDom.configs['flat/recommended'].plugins,
  },
  {
    name: 'testing-library/react',
    files: ['**/*.spec.{ts,js,tsx,jsx}', 'tests/js/**/*.{ts,js,tsx,jsx}'],
    ...testingLibrary.configs['flat/react'],
    rules: {
      ...testingLibrary.configs['flat/react'].rules,
      'testing-library/render-result-naming-convention': 'off',
      'testing-library/no-unnecessary-act': 'off',
    },
  },
  {
    name: 'testing-library/react - tsx files',
    files: ['**/*.spec.{tsx,jsx}', 'tests/js/**/*.{tsx,jsx}'],
    ...testingLibrary.configs['flat/react'],
    rules: {
      'testing-library/no-container': 'warn', // TODO(ryan953): Fix the violations, then delete this line
      'testing-library/no-node-access': 'warn', // TODO(ryan953): Fix the violations, then delete this line
      'testing-library/prefer-query-by-disappearance': 'warn', // TODO(ryan953): Fix the violations, then delete this line
      'testing-library/prefer-screen-queries': 'warn', // TODO(ryan953): Fix the violations, then delete this line
    },
  },
  {
    // We specify rules explicitly for the sdk-loader here so we do not have
    // eslint ignore comments included in the source file, which is consumed
    // by users.
    name: 'js-sdk-loader.ts',
    files: ['**/js-sdk-loader.ts'],
    rules: {
      'no-console': 'off',
    },
  },
  {
    name: 'prettier/recommended',
    ...prettier,
  },
]);
