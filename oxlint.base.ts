import {defineConfig, type OxlintConfig, type OxlintOverride} from 'oxlint';

export const CSS_TYPES_MESSAGE =
  "Use the matching property from the CSS type exported by @sentry/scraps/cssTypes, for example CSS['width'].";

const restrictedThemeImportPattern = {
  group: ['sentry/utils/theme*', 'sentry/utils/theme'],
  importNames: ['lightTheme', 'darkTheme', 'default'],
  message:
    "Use 'useTheme' hook of withTheme HOC instead of importing theme directly. For tests, use ThemeFixture.",
};

const CONVENTIONS_IMPORT_MESSAGE =
  'Only @sentry/conventions/attributes/search imports are allowed in the frontend.';

export const restrictedConventionsImportPattern = {
  group: [
    '@sentry/conventions/**',
    // Unignore the parent so that the search entry point can be allowed below.
    // The attributes entry point itself is restricted by restrictedImportPaths.
    '!@sentry/conventions/attributes',
    '!@sentry/conventions/attributes/search',
    '@sentry/conventions/attributes/search/**',
  ],
  message: CONVENTIONS_IMPORT_MESSAGE,
};

export const restrictedImportPatterns = [
  restrictedThemeImportPattern,
  restrictedConventionsImportPattern,
];

export const restrictedImportPaths = [
  {name: '@sentry/conventions', message: CONVENTIONS_IMPORT_MESSAGE},
  {name: '@sentry/conventions/attributes', message: CONVENTIONS_IMPORT_MESSAGE},
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
      "Please import marked from '@sentry/scraps/markdown' so that we can ensure sanitation of marked output",
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
    name: 'react-router',
    importNames: ['withRouter'],
    message:
      "Use 'useLocation', 'useParams', 'useNavigate', 'useRoutes' from sentry/utils instead.",
  },
  {
    name: 'react-select',
    message: "Use '@sentry/scraps/select' instead.",
  },
  {
    name: 'qs',
    message: 'Please use query-string instead of qs',
  },
  {
    name: 'moment',
    message: 'Please import moment-timezone instead of moment',
  },
  {
    name: 'platformicons/build/platformIcon',
    message: "Import {PlatformIcon} from 'platformicons' instead.",
  },
  {
    name: 'sentry/views/insights/common/components/insightsTimeSeriesWidget',
    message:
      'Do not use this directly in your view component, see https://sentry.sentry.io/stories/shared/views/dashboards/widgets/timeserieswidget/timeserieswidgetvisualization#deeplinking for more information',
  },
  {
    name: 'sentry/views/insights/common/components/insightsLineChartWidget',
    message:
      'Do not use this directly in your view component, see https://sentry.sentry.io/stories/shared/views/dashboards/widgets/timeserieswidget/timeserieswidgetvisualization#deeplinking for more information',
  },
  {
    name: 'sentry/views/insights/common/components/insightsAreaChartWidget',
    message:
      'Do not use this directly in your view component, see https://sentry.sentry.io/stories/shared/views/dashboards/widgets/timeserieswidget/timeserieswidgetvisualization#deeplinking for more information',
  },
  {
    name: 'color',
    message:
      'Only @sentry/scraps is allowed to use color package, please use the values set on the team or reach out to design-engineering for help',
  },
  {
    name: '@figma/code-connect',
    message:
      'The @figma/code-connect package should only be imported in *.figma.tsx files for Figma Code Connect integration',
  },
  {
    name: '@tanstack/react-form',
    message: 'Use @sentry/scraps/form instead',
  },
  {
    name: 'framer-motion',
    importNames: ['Reorder'],
    message: "Do not use framer-motion's Reorder. Use @dnd-kit/sortable instead.",
  },
];

export const coreComponentRules = defineConfig({
  rules: {
    'typescript/no-non-null-assertion': 'error',
    'typescript/no-unsafe-argument': 'error',
    'typescript/no-unsafe-call': 'error',
    'typescript/no-unsafe-enum-comparison': 'error',
    'typescript/no-unsafe-member-access': 'error',
    'typescript/no-unsafe-return': 'error',
  },
}).rules;

export const fakeTimerRules = defineConfig({
  rules: {
    '@sentry/prefer-fake-timers': 'error',
    '@sentry/require-fake-timer-cleanup': 'error',
  },
}).rules;

const testFiles = ['**/*.spec.{ts,js,tsx,jsx}', 'tests/js/**/*.{ts,js,tsx,jsx}'];

export const typescriptOverride: OxlintOverride = {
  files: ['**/*.ts', '**/*.tsx', '**/*.mts', '**/*.cts'],
  rules: {
    'constructor-super': 'off',
    'getter-return': 'off',
    'no-class-assign': 'off',
    'no-const-assign': 'off',
    'no-dupe-class-members': 'off',
    'no-dupe-keys': 'off',
    'no-func-assign': 'off',
    'no-import-assign': 'off',
    'no-new-native-nonconstructor': 'off',
    'no-obj-calls': 'off',
    'no-redeclare': 'off',
    'no-setter-return': 'off',
    'no-this-before-super': 'off',
    'no-undef': 'off',
    'no-unreachable': 'off',
    'no-unsafe-negation': 'off',
    'no-var': 'error',
    'no-with': 'off',
    'prefer-const': 'error',
    'prefer-rest-params': 'error',
  },
};

export const testOverride: OxlintOverride = {
  files: testFiles,
  // Rule references:
  // https://github.com/jest-community/eslint-plugin-jest/tree/main/docs/rules
  // https://github.com/testing-library/eslint-plugin-jest-dom#supported-rules
  // https://github.com/testing-library/eslint-plugin-testing-library/tree/main/docs/rules
  rules: {
    // Disabled because many tests render a component as their validation.
    'jest/expect-expect': 'off',
    'jest/no-alias-methods': 'error',
    'jest/no-commented-out-tests': 'warn',
    // TODO(ryan953): Fix violations, then enable this rule.
    'jest/no-conditional-expect': 'off',
    'jest/no-deprecated-functions': 'error',
    // The recommended preset uses a warning; disabled tests are errors here.
    'jest/no-disabled-tests': 'error',
    'jest/no-done-callback': 'error',
    'jest/no-export': 'error',
    'jest/no-focused-tests': 'error',
    'jest/no-identical-title': 'error',
    'jest/no-interpolation-in-snapshots': 'error',
    'jest/no-jasmine-globals': 'error',
    'jest/no-mocks-import': 'error',
    'jest/no-standalone-expect': [
      'error',
      {
        additionalTestBlockFunctions: ['it.isKnownFlake'],
      },
    ],
    'jest/no-test-prefixes': 'error',
    'jest/valid-describe-callback': 'error',
    'jest/valid-expect': 'error',
    'jest/valid-expect-in-promise': 'error',
    'jest/valid-title': 'error',
    'jest/prefer-to-be': 'error',
    'jest/prefer-to-contain': 'error',
    'jest/prefer-to-have-length': 'error',
    'jest/max-nested-describe': 'error',
    'jest/no-duplicate-hooks': 'error',
    // Snapshots are discouraged; keep the remaining ones small.
    'jest/no-large-snapshots': [
      'error',
      {
        maxSize: 2000,
      },
    ],
    'jest/prefer-hooks-in-order': 'error',
    'jest/prefer-hooks-on-top': 'error',
    'jest/prefer-jest-mocked': 'error',
    'jest-dom/prefer-checked': 'error',
    'jest-dom/prefer-empty': 'error',
    'jest-dom/prefer-enabled-disabled': 'error',
    'jest-dom/prefer-focus': 'error',
    'jest-dom/prefer-in-document': 'error',
    'jest-dom/prefer-required': 'error',
    'jest-dom/prefer-to-have-attribute': 'error',
    'jest-dom/prefer-to-have-class': 'error',
    'jest-dom/prefer-to-have-style': 'error',
    'jest-dom/prefer-to-have-text-content': 'error',
    'jest-dom/prefer-to-have-value': 'error',
    'testing-library/await-async-events': [
      'error',
      {
        eventModule: 'userEvent',
      },
    ],
    'testing-library/await-async-queries': 'error',
    'testing-library/await-async-utils': 'error',
    'testing-library/no-await-sync-events': [
      'error',
      {
        eventModules: ['fire-event'],
      },
    ],
    'testing-library/no-await-sync-queries': 'error',
    'testing-library/no-container': 'error',
    'testing-library/no-debugging-utils': 'warn',
    'testing-library/no-dom-import': ['error', 'react'],
    'testing-library/no-global-regexp-flag-in-query': 'error',
    'testing-library/no-manual-cleanup': 'error',
    'testing-library/no-node-access': 'error',
    'testing-library/no-promise-in-fire-event': 'error',
    'testing-library/no-render-in-lifecycle': 'error',
    'testing-library/no-unnecessary-act': 'off',
    'testing-library/no-wait-for-multiple-assertions': 'error',
    'testing-library/no-wait-for-side-effects': 'error',
    'testing-library/no-wait-for-snapshot': 'error',
    'testing-library/prefer-find-by': 'error',
    'testing-library/prefer-presence-queries': 'error',
    'testing-library/prefer-query-by-disappearance': 'error',
    'testing-library/prefer-screen-queries': 'error',
    'testing-library/render-result-naming-convention': 'off',
  },
  plugins: ['jest'],
};

export const effectOverride: OxlintOverride = {
  files: ['**/*.{js,jsx,mjs,cjs,ts,tsx,mts,cts}'],
  rules: {
    'react-you-might-not-need-an-effect/no-derived-state': 'error',
    'react-you-might-not-need-an-effect/no-chain-state-updates': 'off',
    'react-you-might-not-need-an-effect/no-event-handler': 'off',
    'react-you-might-not-need-an-effect/no-adjust-state-on-prop-change': 'off',
    'react-you-might-not-need-an-effect/no-reset-all-state-on-prop-change': 'off',
    'react-you-might-not-need-an-effect/no-pass-live-state-to-parent': 'off',
    'react-you-might-not-need-an-effect/no-pass-data-to-parent': 'off',
    'react-you-might-not-need-an-effect/no-initialize-state': 'off',
    // TODO(ryan953): fix and turn this on
    'react-you-might-not-need-an-effect/no-external-store-subscription': 'off',
  },
};

export const configOverride: OxlintOverride = {
  files: ['**/*.config.*'],
  rules: {
    'import/no-nodejs-modules': 'off',
  },
  env: {
    node: true,
  },
};

export const storyOverride: OxlintOverride = {
  files: ['**/*.stories.tsx'],
  rules: {
    // Type-loader requires webpack import syntax in stories.
    'import/no-webpack-loader-syntax': 'off',
    // Stories sometimes contain intentionally unusual hard-coded numbers.
    'no-loss-of-precision': 'off',
  },
};

// Share rules explicitly so JS plugins, environments, and settings travel with them.
// Keep application aliases, boundary paths, and suppression policy in the root config.
export const restrictedSyntax = [
  {
    selector:
      "ImportDeclaration[source.value='react'] > ImportSpecifier[imported.name='forwardRef']",
    message:
      'Since React 19, it is no longer necessary to use forwardRef - refs can be passed as a normal prop',
  },
  {
    selector:
      "CallExpression[callee.object.name='React'][callee.property.name='forwardRef']",
    message:
      'Since React 19, it is no longer necessary to use forwardRef - refs can be passed as a normal prop',
  },
  {
    selector: "MemberExpression[object.name='React'][property.name='Fragment']",
    message: "Use `import {Fragment} from 'react'` instead of `React.Fragment`",
  },
  {
    selector: "JSXMemberExpression[object.name='React'][property.name='Fragment']",
    message: "Use `import {Fragment} from 'react'` instead of `React.Fragment`",
  },
  {
    // Require an annotation for uninitialized let declarations, except in
    // for...of and for...in loops.
    selector:
      'VariableDeclaration[kind = "let"]:not(ForOfStatement > VariableDeclaration, ForInStatement > VariableDeclaration) > VariableDeclarator[init = null]:not([id.typeAnnotation])',
    message: 'Provide a type annotation',
  },
  {
    // IIFEs obscure JSX children, attribute values, and spreads.
    selector:
      'JSXExpressionContainer > CallExpression[callee.type="ArrowFunctionExpression"], JSXExpressionContainer > CallExpression[callee.type="FunctionExpression"], JSXSpreadAttribute > CallExpression[callee.type="ArrowFunctionExpression"], JSXSpreadAttribute > CallExpression[callee.type="FunctionExpression"]',
    message: 'Do not use IIFEs inside JSX.',
  },
  {
    selector:
      "TSIndexedAccessType > TSTypeReference.objectType[typeName.name='CSSProperties']",
    message: CSS_TYPES_MESSAGE,
  },
  {
    selector:
      "TSIndexedAccessType > TSTypeReference.objectType > TSQualifiedName.typeName[left.name='React'][right.name='CSSProperties']",
    message: CSS_TYPES_MESSAGE,
  },
  {
    selector: 'ImportDeclaration[source.value=/^!!type-loader!/]',
    message:
      "Use dynamic import for type-loader imports (for example: `import('!!type-loader!@sentry/scraps/alert')`), not `import ... from '!!type-loader!...'`.",
  },
  {
    // Absolute URLs belong in ExternalLink, not the internal router Link.
    selector:
      "JSXOpeningElement[name.name='Link'] JSXAttribute[name.name='to'] Literal[value=/^https?:/i]",
    message: "Do not pass an absolute URL to Link's to=. Use ExternalLink instead.",
  },
];

const base = defineConfig({
  plugins: ['import', 'react', 'typescript', 'unicorn'],
  categories: {
    correctness: 'off',
  },
  env: {
    builtin: true,
    browser: true,
    jest: true,
  },
  jsPlugins: [
    {
      name: 'e18e',
      specifier: '@e18e/eslint-plugin',
    },
    {
      name: '@sentry',
      specifier: '@sentry-internal/eslint-plugin-sentry',
    },
    {
      name: '@sentry/scraps',
      specifier: '@sentry-internal/eslint-plugin-scraps',
    },
    {
      name: 'eslint-js',
      specifier: 'oxlint-plugin-eslint',
    },
    {
      name: 'import-js',
      specifier: 'eslint-plugin-import-x',
    },
    {
      name: 'react-js',
      specifier: 'eslint-plugin-react',
    },
    {
      name: 'unicorn-js',
      specifier: 'eslint-plugin-unicorn',
    },
    '@tanstack/eslint-plugin-query',
    'eslint-plugin-jest-dom',
    'eslint-plugin-react-you-might-not-need-an-effect',
    'eslint-plugin-regexp',
    'eslint-plugin-testing-library',
  ],
  settings: {react: {version: '19.2.0', defaultVersion: '19.2'}},
  ignorePatterns: [
    '**/*.d.ts',
    '**/dist/**/*',
    '**/.types/**/*',
    '**/vendor/**/*',
    '**/*.figma.tsx',
    '**/*.mdx',
    '**/.artifacts/**/*',
  ],
  rules: {
    'no-restricted-imports': [
      'error',
      {patterns: restrictedImportPatterns, paths: restrictedImportPaths},
    ],
    'constructor-super': 'error',
    'for-direction': 'error',
    'getter-return': 'error',
    'no-async-promise-executor': 'error',
    'no-case-declarations': 'error',
    'no-class-assign': 'error',
    'no-compare-neg-zero': 'error',
    'no-cond-assign': ['error', 'always'],
    'no-const-assign': 'error',
    'no-constant-binary-expression': 'error',
    'no-constant-condition': 'error',
    'no-control-regex': 'error',
    'no-debugger': 'error',
    'no-delete-var': 'error',
    'no-dupe-class-members': 'error',
    'no-dupe-else-if': 'error',
    'no-dupe-keys': 'error',
    'no-duplicate-case': 'error',
    'no-empty': 'error',
    'no-empty-pattern': 'error',
    'no-empty-static-block': 'error',
    'no-ex-assign': 'error',
    'no-extra-boolean-cast': 'error',
    'no-fallthrough': 'error',
    'no-func-assign': 'error',
    'no-global-assign': 'error',
    'no-import-assign': 'error',
    'no-irregular-whitespace': 'error',
    'no-loss-of-precision': 'error',
    'no-misleading-character-class': 'error',
    'no-new-native-nonconstructor': 'error',
    'no-nonoctal-decimal-escape': 'error',
    'no-obj-calls': 'error',
    'no-prototype-builtins': 'error',
    'no-redeclare': 'error',
    'no-regex-spaces': 'error',
    'no-self-assign': 'error',
    'no-setter-return': 'error',
    'no-shadow-restricted-names': 'error',
    'no-sparse-arrays': 'error',
    'no-this-before-super': 'error',
    'no-undef': 'error',
    'no-unreachable': 'error',
    'no-unsafe-finally': 'error',
    'no-unsafe-negation': 'error',
    // Oxlint reports TypeScript patterns that ESLint accepts and suggests
    // replacing optional access with unsafe non-null assertions.
    'no-unsafe-optional-chaining': 'off',
    'no-unused-labels': 'error',
    'no-unused-private-class-members': 'error',
    'no-useless-catch': 'error',
    'no-useless-escape': 'error',
    'no-with': 'error',
    'require-yield': 'error',
    'use-isnan': 'error',
    'valid-typeof': 'error',
    'block-scoped-var': 'error',
    eqeqeq: 'error',
    'no-alert': 'error',
    'no-caller': 'error',
    'no-console': 'error',
    'no-else-return': [
      'error',
      {
        allowElseIf: false,
      },
    ],
    'no-eval': 'error',
    'no-extend-native': 'error',
    'no-extra-bind': 'error',
    'no-inner-declarations': 'error',
    'no-lone-blocks': 'error',
    'no-multi-str': 'error',
    'no-new-func': 'error',
    'no-new-wrappers': 'error',
    'no-new': 'error',
    'no-proto': 'error',
    'no-return-assign': 'error',
    'no-script-url': 'error',
    'no-self-compare': 'error',
    'no-sequences': 'error',
    'no-useless-computed-key': 'error',
    'object-shorthand': ['error', 'properties'],
    'prefer-arrow-callback': [
      'error',
      {
        allowNamedFunctions: true,
      },
    ],
    radix: 'error',
    yoda: 'error',
    'e18e/prefer-includes': 'error',
    // The ESLint plugin does not report the existing copy-then-mutate forms.
    'e18e/prefer-array-to-reversed': 'off',
    'e18e/prefer-array-to-sorted': 'off',
    'e18e/prefer-array-to-spliced': 'error',
    'e18e/prefer-nullish-coalescing': 'error',
    'e18e/prefer-url-canparse': 'error',
    'e18e/prefer-array-from-map': 'error',
    'e18e/prefer-date-now': 'error',
    'e18e/prefer-array-some': 'error',
    'e18e/prefer-string-fromcharcode': 'error',
    'import/export': 'error',
    'import/no-absolute-path': 'error',
    'import/no-amd': 'error',
    'import/no-anonymous-default-export': 'error',
    'import/no-duplicates': 'error',
    'import/no-named-default': 'error',
    'import/no-nodejs-modules': 'error',
    // Catches the parent-relative forms that `@sentry/no-relative-import-paths`
    // lets through: dynamic `import()`, a bare `'..'`, and `'./../foo'`.
    'import/no-relative-parent-imports': 'error',
    'import/no-webpack-loader-syntax': 'error',
    '@sentry/no-calling-components-as-functions': 'error',
    '@sentry/no-digits-in-tn': 'error',
    '@sentry/no-dynamic-translations': 'error',
    '@sentry/no-flag-comments': 'error',
    '@sentry/no-legacy-router-imports': 'error',
    '@sentry/no-query-data-type-parameters': 'error',
    '@sentry/no-raw-css-in-styled': 'error',
    '@sentry/no-redundant-default-argument': 'error',
    '@sentry/no-static-translations': 'error',
    '@sentry/no-styled-shortcut': 'error',
    '@sentry/no-unnecessary-use-callback': 'error',
    '@sentry/no-useless-css-interpolation-semicolon': 'error',
    '@sentry/prefer-react-component': 'error',
    '@sentry/scraps/no-core-import': 'error',
    '@sentry/scraps/no-double-dollar-interpolation': 'error',
    '@sentry/scraps/no-restricted-module-mocks': 'error',
    '@sentry/scraps/no-token-import': 'error',
    '@sentry/scraps/prefer-info-text': 'error',
    '@sentry/scraps/prefer-stack-for-column-flex': 'error',
    '@sentry/scraps/require-field-component': 'error',
    '@sentry/scraps/require-render-prop-spread': 'error',
    '@sentry/scraps/use-semantic-token': [
      'error',
      {
        enabledCategories: ['background', 'border', 'content'],
      },
    ],
    '@sentry/scraps/restrict-jsx-slot-children': [
      'error',
      {
        slots: [
          {
            componentNames: ['CompactSelect'],
            propNames: ['menuFooter'],
            allowed: [
              {
                source: '@sentry/scraps/compactSelect',
                names: [
                  'MenuComponents.CTAButton',
                  'MenuComponents.CTALinkButton',
                  'MenuComponents.ApplyButton',
                  'MenuComponents.CancelButton',
                  'MenuComponents.Alert',
                ],
              },
              {
                source: '@sentry/scraps/layout',
                names: ['Flex', 'Stack', 'Grid', 'Container'],
              },
            ],
          },
          {
            componentNames: ['CompactSelect'],
            propNames: ['menuHeaderTrailingItems'],
            allowed: [
              {
                source: '@sentry/scraps/compactSelect',
                names: [
                  'MenuComponents.HeaderButton',
                  'MenuComponents.ClearButton',
                  'MenuComponents.ResetButton',
                ],
              },
              {
                source: '@sentry/scraps/layout',
                names: ['Flex', 'Stack', 'Grid', 'Container'],
              },
            ],
          },
        ],
      },
    ],
    '@tanstack/query/exhaustive-deps': [
      'error',
      {
        allowlist: {
          variables: ['api'],
          types: ['Client'],
        },
      },
    ],
    '@tanstack/query/no-rest-destructuring': 'error',
    '@tanstack/query/stable-query-client': 'error',
    '@tanstack/query/no-unstable-deps': 'error',
    '@tanstack/query/infinite-query-property-order': 'error',
    '@tanstack/query/no-void-query-fn': 'error',
    '@tanstack/query/mutation-property-order': 'error',
    'react/capitalized-calls': 'error',
    'react/error-boundaries': 'error',
    'react/exhaustive-effect-dependencies': 'error',
    'react/function-component-definition': 'error',
    'react/globals': 'error',
    'react/hooks': 'error',
    'react/immutability': 'error',
    'react/incompatible-library': 'error',
    'react/invariant': 'error',
    'react/jsx-boolean-value': ['error', 'never'],
    'react/jsx-fragments': ['error', 'element'],
    'react/jsx-key': [
      'error',
      {
        checkFragmentShorthand: false,
        checkKeyMustBeforeSpread: false,
        warnOnDuplicates: false,
      },
    ],
    'react/jsx-no-comment-textnodes': 'error',
    'react/jsx-no-duplicate-props': 'error',
    'react/jsx-no-target-blank': 'error',
    'react/jsx-no-undef': 'error',
    'react/no-children-prop': 'error',
    'react/no-danger-with-children': 'error',
    'react/no-direct-mutation-state': 'error',
    'react/no-find-dom-node': 'error',
    'react/no-is-mounted': 'error',
    'react/no-render-return-value': 'error',
    'react/no-string-refs': 'error',
    'react/no-unstable-nested-components': ['error', {allowAsProps: true}],
    'react/no-unknown-property': [
      'error',
      {
        ignore: ['css'],
      },
    ],
    'react/memo-dependencies': 'error',
    'react/no-deriving-state-in-effects': 'error',
    'react/preserve-manual-memoization': 'error',
    'react/purity': 'error',
    'react/refs': 'error',
    'react/require-render-return': 'error',
    'react/rule-suppression': 'off',
    'react/set-state-in-effect': 'error',
    'react/set-state-in-render': 'error',
    'react/static-components': 'error',
    'react/syntax': 'error',
    'react/todo': 'error',
    'react/unsupported-syntax': 'error',
    'react/use-memo': 'error',
    'react/void-use-memo': 'error',
    'react/no-did-mount-set-state': 'error',
    'react/no-did-update-set-state': 'error',
    'react/no-redundant-should-component-update': 'error',
    'react/self-closing-comp': 'error',
    'react/jsx-curly-brace-presence': [
      'error',
      {
        props: 'never',
        children: 'ignore',
        propElementValues: 'always',
      },
    ],
    'no-array-constructor': 'error',
    'no-unused-expressions': [
      'error',
      {
        allowTernary: true,
      },
    ],
    'no-useless-constructor': 'error',
    '@sentry/no-default-exports': 'error',
    '@sentry/sort-interface-keys': [
      'error',
      'asc',
      {
        caseSensitive: true,
        natural: false,
        requiredFirst: true,
      },
    ],
    '@sentry/no-vanilla-emotion': 'error',
    '@sentry/emotion-styled-import': 'error',
    '@sentry/emotion-syntax-preference': ['error', 'string'],
    'unicorn/custom-error-definition': 'error',
    'unicorn/error-message': 'error',
    'unicorn/escape-case': 'error',
    'unicorn/filename-case': [
      'error',
      {
        case: 'camelCase',
        ignore: [
          '^jest-pegjs-transform\\.js$',
          '^jest-environment\\.cjs$',
          '^jest-environment-node\\.cjs$',
          // Mocks named after external packages must preserve the package's
          // kebab-case basename so Jest can resolve them.
          '^(?:analytics-browser|react-(?:date-range|lazyload))\\.tsx$',
          // Unicorn changes capitalized abbreviations in camel-cased filenames:
          // CTA to Cta, SDK to Sdk, and WebGL to WebGl. Keep the conventional
          // capitalization when the rest of the filename is camel-cased.
          '^[a-z][a-zA-Z\\d]*[A-Z]{2,}[a-zA-Z\\d]*(?:\\.[a-z\\d]+)+$',
          '^[A-Z]{2,}[a-zA-Z\\d]*(?:\\.[a-z\\d]+)+$',
          // Shebang scripts cannot use an inline disable above line 1 and are
          // invoked by their kebab-case package/CI names, so ignore them here.
          'analyze-styled\\.ts$',
          'type-coverage\\.ts$',
          'type-coverage-diff\\.ts$',
          '^oxlint-suppressions\\.ts$',
          'AiSetupDataConsent\\.tsx$',
          'CredentialRow\\.tsx$',
          'DevKitSettings\\.tsx$',
          'DurationCell\\.tsx$',
          'EmptyState\\.tsx$',
          'ErrorRateCell\\.tsx$',
          'FlamegraphWarnings\\.spec\\.tsx$',
          'FlamegraphWarnings\\.tsx$',
          'FormSearch\\.tsx$',
          'IssueListCacheStore\\.tsx$',
          'IssueStreamHeaderLabel\\.tsx$',
          'NoProjectEmptyState\\.tsx$',
          'NumberCell\\.tsx$',
          'PinnedLogs\\.spec\\.tsx$',
          'PinnedLogs\\.tsx$',
          'PlayStationSettings\\.tsx$',
          'RequestIntegrationButton\\.tsx$',
          'RequestIntegrationModal\\.tsx$',
          'RequestSdkAccessButton\\.tsx$',
          'SplitInstallationIdModal\\.tsx$',
          'ThresholdCell\\.tsx$',
          'VirtualizedTreeNode\\.spec\\.tsx$',
          'VirtualizedTreeNode\\.tsx$',
          'VirtualizedTree\\.spec\\.tsx$',
          'VirtualizedTree\\.tsx$',
          'build-chartcuterie\\.ts$',
          'build-js-loader\\.ts$',
          'dev-ui-server\\.ts$',
          'sentry-jest-environment\\.d\\.ts$',
          'snapshot-framework\\.ts$',
          'snapshot-image-metadata\\.ts$',
          'snapshot-setup\\.ts$',
        ],
      },
    ],
    'unicorn/new-for-builtins': 'error',
    'unicorn/no-abusive-eslint-disable': 'error',
    'unicorn/no-accessor-recursion': 'error',
    'unicorn/no-anonymous-default-export': 'error',
    'unicorn/no-await-in-promise-methods': 'error',
    'unicorn/no-console-spaces': 'off',
    'unicorn/no-empty-file': 'error',
    'unicorn/no-instanceof-builtins': 'error',
    'unicorn/no-invalid-fetch-options': 'error',
    'unicorn/no-invalid-remove-event-listener': 'error',
    'unicorn/no-negated-condition': 'error',
    'unicorn/no-negation-in-equality-check': 'error',
    'unicorn/no-new-array': 'error',
    'unicorn/no-new-buffer': 'error',
    'unicorn/no-single-promise-in-promise-methods': 'error',
    'unicorn/no-typeof-undefined': 'error',
    'unicorn/no-unnecessary-await': 'error',
    'unicorn/no-unreadable-iife': 'error',
    'unicorn/no-useless-collection-argument': 'error',
    'unicorn/no-useless-error-capture-stack-trace': 'error',
    'unicorn/no-useless-fallback-in-spread': 'error',
    'unicorn/no-useless-iterator-to-array': 'error',
    'unicorn/no-useless-length-check': 'error',
    'unicorn/no-useless-undefined': [
      'error',
      {
        checkArguments: false,
      },
    ],
    'unicorn/no-zero-fractions': 'error',
    'unicorn/prefer-array-find': 'error',
    'unicorn/prefer-array-flat-map': 'error',
    'unicorn/prefer-array-index-of': 'error',
    'unicorn/prefer-array-some': 'error',
    'unicorn/prefer-blob-reading-methods': 'error',
    'unicorn/prefer-classlist-toggle': 'error',
    'unicorn/prefer-date-now': 'error',
    'unicorn/prefer-default-parameters': 'error',
    'unicorn/prefer-event-target': 'error',
    'unicorn/prefer-includes': 'off',
    'unicorn/prefer-keyboard-event-key': 'error',
    'unicorn/prefer-math-trunc': 'error',
    'unicorn/prefer-modern-dom-apis': 'off',
    'unicorn/prefer-modern-math-apis': 'error',
    'unicorn/prefer-native-coercion-functions': 'error',
    'unicorn/prefer-negative-index': 'error',
    'unicorn/prefer-node-protocol': 'error',
    'unicorn/prefer-prototype-methods': 'error',
    'unicorn/prefer-reflect-apply': 'error',
    'unicorn/prefer-response-static-json': 'error',
    'unicorn/prefer-set-size': 'error',
    'unicorn/prefer-string-trim-start-end': 'error',
    'unicorn/relative-url-style': 'error',
    'unicorn/require-module-attributes': 'error',
    'unicorn/require-module-specifiers': 'error',
    'unicorn/throw-new-error': 'error',
    'unicorn/no-instanceof-array': 'error',
    'regexp/confusing-quantifier': 'warn',
    'regexp/control-character-escape': 'error',
    'regexp/match-any': 'error',
    'regexp/negation': 'error',
    'regexp/no-contradiction-with-assertion': 'error',
    'regexp/no-dupe-characters-character-class': 'error',
    'regexp/no-dupe-disjunctions': 'error',
    'regexp/no-empty-alternative': 'warn',
    'regexp/no-empty-capturing-group': 'error',
    'regexp/no-empty-character-class': 'error',
    'regexp/no-empty-group': 'error',
    'regexp/no-empty-lookarounds-assertion': 'error',
    'regexp/no-empty-string-literal': 'error',
    'regexp/no-escape-backspace': 'error',
    'regexp/no-extra-lookaround-assertions': 'error',
    'regexp/no-invalid-regexp': 'error',
    'regexp/no-invisible-character': 'error',
    'regexp/no-lazy-ends': 'warn',
    'regexp/no-legacy-features': 'error',
    'regexp/no-misleading-unicode-character': 'error',
    'regexp/no-missing-g-flag': 'error',
    'regexp/no-non-standard-flag': 'error',
    'regexp/no-optional-assertion': 'error',
    'regexp/no-potentially-useless-backreference': 'warn',
    'regexp/no-trivially-nested-assertion': 'error',
    'regexp/no-trivially-nested-quantifier': 'error',
    'regexp/no-useless-assertions': 'error',
    'regexp/no-useless-backreference': 'error',
    'regexp/no-useless-character-class': 'error',
    'regexp/no-useless-dollar-replacements': 'error',
    'regexp/no-useless-escape': 'error',
    'regexp/no-useless-flag': 'warn',
    'regexp/no-useless-lazy': 'error',
    'regexp/no-useless-non-capturing-group': 'error',
    'regexp/no-useless-quantifier': 'error',
    'regexp/no-useless-range': 'error',
    'regexp/no-useless-set-operand': 'error',
    'regexp/no-useless-string-literal': 'error',
    'regexp/no-useless-two-nums-quantifier': 'error',
    'regexp/no-zero-quantifier': 'error',
    'regexp/optimal-lookaround-quantifier': 'warn',
    'regexp/prefer-character-class': 'error',
    'regexp/prefer-d': 'error',
    'regexp/prefer-plus-quantifier': 'error',
    'regexp/prefer-predefined-assertion': 'error',
    'regexp/prefer-question-quantifier': 'error',
    'regexp/prefer-range': 'error',
    'regexp/prefer-set-operation': 'error',
    'regexp/prefer-star-quantifier': 'error',
    'regexp/prefer-unicode-codepoint-escapes': 'error',
    'regexp/prefer-w': 'error',
    'regexp/simplify-set-operations': 'error',
    'regexp/sort-flags': 'error',
    curly: 'error',
    'no-shadow': 'error',
    'no-loop-func': 'error',
    'react/exhaustive-deps': [
      'error',
      {
        additionalHooks: '(useEffectAfterFirstRender|useMemoWithPrevious)',
      },
    ],
    'react/rules-of-hooks': 'error',
    'typescript/await-thenable': 'error',
    'typescript/ban-ts-comment': [
      'error',
      {
        minimumDescriptionLength: 10,
      },
    ],
    'typescript/no-array-delete': 'error',
    'typescript/no-base-to-string': 'error',
    'typescript/no-duplicate-enum-values': 'error',
    'typescript/no-duplicate-type-constituents': 'error',
    'typescript/no-empty-object-type': [
      'error',
      {
        allowInterfaces: 'always',
      },
    ],
    'typescript/no-extra-non-null-assertion': 'error',
    'typescript/no-extraneous-class': 'error',
    'typescript/no-for-in-array': 'error',
    'typescript/no-generated-empty-object-type': 'error',
    'typescript/no-implied-eval': 'error',
    'typescript/no-meaningless-void-operator': 'error',
    'typescript/no-misused-new': 'error',
    'typescript/no-non-null-asserted-nullish-coalescing': 'error',
    'typescript/no-unnecessary-boolean-literal-compare': 'error',
    'typescript/no-unnecessary-template-expression': 'error',
    'typescript/no-unnecessary-type-arguments': 'error',
    // Oxlint's checker removes assertions that document and constrain values
    // accepted by wider receiver types.
    'typescript/no-unnecessary-type-assertion': 'off',
    'typescript/no-unnecessary-type-constraint': 'error',
    'typescript/no-unnecessary-type-parameters': 'error',
    'typescript/no-unsafe-declaration-merging': 'error',
    'typescript/no-unsafe-function-type': 'error',
    'typescript/no-unsafe-unary-minus': 'error',
    'typescript/no-useless-default-assignment': 'error',
    'typescript/no-wrapper-object-types': 'error',
    'typescript/only-throw-error': 'error',
    'typescript/prefer-as-const': 'error',
    'typescript/prefer-literal-enum-member': 'error',
    'typescript/prefer-namespace-keyword': 'error',
    'typescript/prefer-promise-reject-errors': 'error',
    'typescript/prefer-reduce-type-parameter': 'error',
    'typescript/prefer-return-this-type': 'error',
    'typescript/related-getter-setter-pairs': 'error',
    'typescript/require-await': 'error',
    'typescript/return-await': ['error', 'error-handling-correctness-only'],
    'typescript/triple-slash-reference': 'error',
    'typescript/adjacent-overload-signatures': 'error',
    'typescript/array-type': [
      'error',
      {
        default: 'array-simple',
      },
    ],
    'typescript/ban-tslint-comment': 'error',
    // Oxlint currently enforces this rule differently from typescript-eslint and
    // would require behavior-neutral churn throughout the frontend.
    'typescript/consistent-generic-constructors': 'off',
    'typescript/consistent-indexed-object-style': 'error',
    'typescript/consistent-type-assertions': 'error',
    'typescript/dot-notation': 'error',
    'typescript/no-confusing-non-null-assertion': 'error',
    'typescript/no-inferrable-types': 'error',
    'typescript/non-nullable-type-assertion-style': 'error',
    'typescript/prefer-for-of': 'error',
    'typescript/prefer-function-type': 'error',
    // Keep explicit guards when optional chaining can change runtime behavior,
    // especially for undeclared globals such as webpack's `module`.
    'typescript/prefer-optional-chain': 'off',
    'typescript/consistent-type-exports': 'error',
    'typescript/switch-exhaustiveness-check': [
      'error',
      {
        considerDefaultExhaustiveForUnions: true,
      },
    ],
    'typescript/no-restricted-types': [
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
    'typescript/no-useless-empty-export': 'error',
    'typescript/prefer-enum-initializers': 'error',
    // JavaScript-plugin fallbacks for rules Oxlint does not implement natively.
    // https://eslint.org/docs/latest/rules/
    'eslint-js/multiline-comment-style': ['error', 'separate-lines'],
    'eslint-js/no-octal': ['error'],
    'eslint-js/no-octal-escape': ['error'],
    'eslint-js/no-restricted-syntax': ['error', ...restrictedSyntax],
    'eslint-js/spaced-comment': [
      'error',
      'always',
      {
        line: {
          markers: ['/'],
          exceptions: ['-', '+'],
        },
        block: {
          exceptions: ['*'],
          balanced: true,
        },
      },
    ],
    // https://github.com/un-ts/eslint-plugin-import-x/tree/master/docs/rules
    'import-js/no-relative-packages': 'error',
    'import-js/no-extraneous-dependencies': [
      'error',
      {
        includeTypes: true,
        devDependencies: true,
      },
    ],
    // https://github.com/jsx-eslint/eslint-plugin-react/tree/master/docs/rules
    'react-js/no-deprecated': ['error'],
    'react-js/no-typos': ['error'],
    'react-js/sort-comp': ['error'],
    '@sentry/naming-convention': 'error',
    // https://github.com/sindresorhus/eslint-plugin-unicorn#rules
    'unicorn-js/expiring-todo-comments': [
      'error',
      {
        terms: ['todo', 'fixme', 'xxx'],
        ignore: [],
        // Dates are never enforced: a TODO quietly reaching its expiry should not
        // be what breaks master for everyone else.
        checkDates: false,
        allowWarningComments: true,
      },
    ],
    'unicorn-js/no-unnecessary-polyfills': ['error'],
    // The successor to `no-array-push-push`, which unicorn 74 removed. Off for now:
    // it also covers `unshift` and non-adjacent calls, so it flags 38 sites, and its
    // fix folds long object literals into one argument list, which reads worse.
    'unicorn-js/prefer-single-call': 'off',
    // Off since unicorn 73 started treating `x == null` as a simple condition,
    // which flags ~600 call sites here. Every one is the rule's "unsafe" variant:
    // reordering the operands can change what the short-circuit guards against, so
    // they need to be read individually rather than swept through.
    'unicorn-js/prefer-simple-condition-first': 'off',
  },
  overrides: [
    typescriptOverride,
    testOverride,
    effectOverride,
    configOverride,
    storyOverride,
  ],
});

export default base;

export const packageImports = {
  patterns: [
    ...restrictedImportPatterns,
    {
      group: [
        'sentry',
        'sentry/**',
        'sentry-test',
        'sentry-test/**',
        'sentry-fixture',
        'sentry-fixture/**',
        'getsentry',
        'getsentry/**',
        'getsentry-test',
        'getsentry-test/**',
        'admin',
        'admin/**',
      ],
      message:
        'Packages must be independent of the Sentry application and its test helpers.',
    },
  ],
  paths: restrictedImportPaths,
};

// Package configs share the full policy, including fields not inherited by extends.
export function createPackageConfig(
  directory: string,
  config: Pick<OxlintConfig, 'rules' | 'overrides'> = {}
) {
  const resolver = {typescript: {project: directory + '/tsconfig.json'}};
  return defineConfig({
    ...base,
    jsPlugins: [
      ...base.jsPlugins,
      {name: 'boundaries', specifier: '@boundaries/eslint-plugin'},
    ],
    settings: {
      ...base.settings,
      'import/resolver': resolver,
      'import-x/resolver': resolver,
      'boundaries/root-path': directory,
      'boundaries/dependency-nodes': ['import', 'dynamic-import'],
      'boundaries/elements': [
        {type: 'source', pattern: 'src', partialMatch: false},
        {type: 'test-support', pattern: 'test', partialMatch: false},
        {type: 'tooling', pattern: 'scripts'},
      ],
      'boundaries/files': [
        {category: 'source', pattern: ['src/**/*']},
        {category: 'config', pattern: ['*.config.*']},
        {category: 'test', pattern: ['**/*.spec.{ts,tsx,js,jsx}', 'test/**/*']},
        {category: 'story', pattern: ['**/*.stories.{ts,tsx}', '**/__stories__/**/*']},
      ],
      'boundaries/elements-single-match': true,
      'boundaries/legacy-templates': false,
      'boundaries/legacy-warnings': false,
    },
    rules: {
      ...base.rules,
      'no-restricted-imports': ['error', packageImports],
      'boundaries/no-unknown-files': 'error',
      'boundaries/dependencies': [
        'error',
        {
          default: 'allow',
          checkInternals: true,
          policies: [
            {
              disallow: {
                from: {file: {categories: {noneOf: ['test']}}},
                to: {file: {categories: 'test'}},
              },
            },
            {
              disallow: {
                from: {file: {categories: {noneOf: ['story']}}},
                to: {file: {categories: 'story'}},
              },
            },
          ],
        },
      ],
      ...config.rules,
    },
    overrides: [
      ...base.overrides,
      {
        files: ['**/*.config.*'],
        rules: {
          '@sentry/no-default-exports': 'off',
          'import/no-relative-parent-imports': 'off',
          'import-js/no-relative-packages': 'off',
        },
      },
      {
        files: ['**/*.spec.{ts,tsx,js,jsx}', 'test/**/*.{ts,tsx,mjs}'],
        env: {node: true},
        rules: {
          'import/no-nodejs-modules': 'off',
          'no-loss-of-precision': 'off',
          '@sentry/prefer-react-component': 'off',
          'no-restricted-imports': [
            'error',
            {
              ...packageImports,
              paths: restrictedImportPaths.filter(
                ({name}) => !name.startsWith('@testing-library/')
              ),
            },
          ],
        },
      },
      {
        files: ['**/*.spec.{ts,tsx,js,jsx}'],
        rules: fakeTimerRules,
      },
      ...(config.overrides ?? []),
    ],
  });
}
