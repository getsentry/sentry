import {defineConfig, type OxlintConfig} from 'oxlint';

import base, {
  CSS_TYPES_MESSAGE,
  coreComponentRules,
  fakeTimerRules,
  restrictedConventionsImportPattern,
  restrictedImportPatterns,
  restrictedImportPaths,
  configOverride,
  effectOverride,
  storyOverride,
  testOverride,
  typescriptOverride,
} from './oxlint.base.ts';

const coreComponentFiles = [
  'static/app/components/core/**/*.{js,mjs,ts,jsx,tsx}',
  'static/packages/scraps/src/**/*.{ts,tsx}',
];

const testFiles = ['**/*.spec.{ts,js,tsx,jsx}', 'tests/js/**/*.{ts,js,tsx,jsx}'];

const tableComponentFiles = [
  'static/app/components/core/table/**/*.{ts,tsx}',
  'static/app/components/tables/**/*.{ts,tsx}',
];

// incubator rules disallow new violations from being introduced
// but suppress pre-existing violations on `master`
export const incubator = defineConfig({
  rules: {
    '@sentry/scraps/no-dom-coupling': 'error',
    '@sentry/scraps/no-manual-table': 'error',
    '@sentry/scraps/prefer-primitives': 'error',
    '@sentry/scraps/prefer-container-responsive-props': 'error',
  },
  overrides: [
    {
      files: coreComponentFiles,
      rules: {
        '@sentry/scraps/no-dom-coupling': 'off',
        '@sentry/scraps/prefer-primitives': 'off',
      },
    },
    {
      files: [
        ...tableComponentFiles,
        ...testFiles,
        '**/*.stories.{ts,tsx}',
        'static/app/stories/**/*.{ts,tsx}',
      ],
      rules: {'@sentry/scraps/no-manual-table': 'off'},
    },
    {
      files: testFiles,
      rules: {
        ...fakeTimerRules,
        '@sentry/scraps/prefer-primitives': 'off',
      },
    },
  ],
});

/**
 * Oxlint configuration reference:
 * https://oxc.rs/docs/guide/usage/linter/config.html
 * https://oxc.rs/docs/guide/usage/linter/rules.html
 *
 * Inspect the resolved configuration with:
 * `pnpm run lint:js -- --print-config`
 */

const CHARTCUTERIE_MESSAGE =
  'Chartcuterie runs server-side in Node.js. This import is not available.';

const storyFilesPolicy = {
  from: [
    {
      element: {
        type: 'story-book',
      },
    },
    {
      file: {
        categories: 'story-files',
      },
    },
  ],
  allow: [
    {
      to: {
        element: {
          type: 'story-book',
        },
      },
    },
    {
      to: {
        file: {
          categories: 'story-files',
        },
      },
    },
    {
      to: {
        file: {
          categories: 'test-fixtures',
        },
      },
    },
  ],
};

/**
 * Import linting uses two complementary approaches:
 *
 * 1. `no-restricted-imports` controls third-party dependencies and preferred
 *    package entry points.
 * 2. `boundaries/dependencies` controls the architecture of local modules such
 *    as Sentry, GetSentry, admin, tests, stories, and Scraps.
 */
const config = defineConfig({
  ...base,
  jsPlugins: [
    ...base.jsPlugins,
    {name: 'boundaries', specifier: '@boundaries/eslint-plugin'},
  ],
  options: {
    typeAware: true,
    reportUnusedDisableDirectives: 'error',
  },
  globals: {
    MockApiClient: 'writable',
    tick: 'writable',
  },
  settings: {
    ...base.settings,
    'import/resolver': {
      typescript: {project: './tsconfig.lint.json'},
    },
    'import-x/resolver': {
      typescript: {project: './tsconfig.lint.json'},
    },
    // Shared test helpers and assets use source aliases, not package dependencies.
    // Keep workspace package imports subject to dependency checks.
    'import-x/internal-regex':
      '^(?:sentry-(?:fixture|test|images|locale|logos|fonts)|getsentry-(?:test|images))(?:/|$)',
    // Analyze both static and dynamic imports for boundary checks.
    // https://www.jsboundaries.dev/docs/setup/settings/#boundariesdependency-nodes
    'boundaries/dependency-nodes': ['import', 'dynamic-import'],
    // Order matters because several element roots are nested inside static/app.
    'boundaries/elements': [
      {
        type: 'icons',
        pattern: 'static/packages/icons/src',
        partialMatch: false,
      },
      {
        type: 'search-syntax',
        pattern: 'static/packages/search-syntax/src',
        partialMatch: false,
      },
      // Domain badges stay in the app after the generic badge primitives move.
      {
        type: 'sentry',
        pattern: 'static/app/components/core/badge',
        partialMatch: false,
      },
      // Keep core stories inside Scraps; story-files still classifies them as stories.
      {
        type: 'scraps',
        pattern: ['static/app/components/core', 'static/packages/scraps/src'],
        partialMatch: false,
      },
      {
        type: 'story-book',
        pattern: ['static/app/stories', '**/__stories__'],
      },
      // Debug tools such as the notification debugger.
      {
        type: 'debug-tools',
        pattern: 'static/app/debug',
      },
      {
        type: 'test',
        pattern: [
          'tests/js',
          'static/packages/scraps/test',
          'static/packages/icons/test',
        ],
      },
      // Sentry application and assets.
      {
        type: 'sentry-images',
        pattern: 'static/images',
      },
      {
        type: 'sentry-logos',
        pattern: 'src/sentry/static/sentry/images/logos',
      },
      {
        type: 'sentry-fonts',
        pattern: 'static/fonts',
      },
      {
        type: 'sentry',
        pattern: 'static/app',
      },
      // GetSentry application.
      {
        type: 'getsentry',
        pattern: 'static/gsApp',
      },
      // GetSentry admin application.
      {
        type: 'gsAdmin',
        pattern: 'static/gsAdmin',
      },
      {
        type: 'build-utils',
        pattern: 'build-utils',
      },
      {
        type: 'scripts',
        pattern: 'scripts',
      },
      // Local lint plugins and compatibility wrappers.
      {
        type: 'oxlint',
        pattern: 'static/oxlint',
      },
    ],
    // File descriptors match complete file paths, preserving classifications
    // that cut across the element roots above.
    'boundaries/files': [
      // Stories and Storybook sources.
      {
        category: 'story-files',
        pattern: [
          'static/app/stories/**/*',
          '**/__stories__/**/*',
          'static/**/*.stories.{ts,tsx}',
          'static/**/*.mdx',
        ],
      },
      // Tests and their support code are separate categories so production
      // files cannot accidentally depend on either.
      {
        category: 'test',
        pattern: [
          'static/**/*.spec.{js,jsx,ts,tsx}',
          'static/**/*.test.{js,jsx,ts,tsx}',
          'static/**/*.snapshots.{js,jsx,ts,tsx}',
          'tests/js/**/*.spec.{js,jsx,ts,tsx}',
          'tests/js/**/*.test.{js,jsx,ts,tsx}',
        ],
      },
      {
        category: 'test-support',
        pattern: [
          'jest.config.mjs',
          'scripts/testCi.js',
          'static/{app,gsApp,gsAdmin}/jest.config.mjs',
          'static/oxlint/*/jest.config.mjs',
          'tests/js/fixtures/**/*',
          'tests/js/sentry-test/**/*',
          'static/packages/scraps/test/**/*',
          'tests/js/getsentry-test/**/*',
          'static/gsApp/__fixtures__/**/*',
          'static/**/*{t,T}estUtils*.{js,jsx,mjs,ts,tsx}',
        ],
      },
      // Fixtures are a second, narrower classification on top of test-support.
      // Stories need realistic data objects, so they are granted this subset
      // without opening up mocks, render helpers, or the rest of test-support.
      {
        category: 'test-fixtures',
        pattern: ['tests/js/fixtures/**/*', 'static/gsApp/__fixtures__/**/*'],
      },
      {
        category: 'sentry-locale',
        pattern: ['static/app/locale.tsx', 'src/sentry/locale/**/*.*'],
      },
      {
        category: 'configs',
        pattern: [
          'package.json',
          'config/**/*.*',
          '*.config.{mjs,js,ts}',
          'oxlint.base.ts',
          'stylelint.base.js',
        ],
      },
    ],
    // All descriptors and selectors use the v7 entity/query model.
    'boundaries/elements-single-match': true,
    'boundaries/legacy-templates': false,
    'boundaries/legacy-warnings': false,
  },
  ignorePatterns: [
    'static/packages/icons/**/*',
    'static/packages/scraps/**/*',
    'static/packages/search-syntax/**/*',
    '.devenv/**/*',
    '.agents/**/*',
    '.github/**/*',
    '.sentry-refactor-tasks/**/*',
    '.mypy_cache/**/*',
    '.pytest_cache/**/*',
    '.venv/**/*',
    '**/*.d.ts',
    '**/dist/**/*',
    'tests/**/fixtures/**/*',
    '!tests/js/**/*',
    '**/vendor/**/*',
    'build-utils/**/*',
    'config/chartcuterie/config.js',
    'figma.config.json',
    'fixtures/artifact_bundle/**/*',
    'fixtures/artifact_bundle_debug_ids/**/*',
    'fixtures/artifact_bundle_duplicated_debug_ids/**/*',
    'fixtures/profiles/embedded.js',
    'api-docs/**/*',
    'src/sentry/static/sentry/js/**/*',
    'src/sentry/templates/sentry/**/*',
    'stylelint.config.js',
    '.artifacts/**/*',
    // Generated by Figma Code Connect.
    '**/*.figma.tsx',
    '**/*.mdx',
  ],
  rules: {
    ...base.rules,
    'no-restricted-imports': [
      'error',
      {
        patterns: restrictedImportPatterns,
        paths: restrictedImportPaths,
      },
    ],
    '@sentry/no-relative-import-paths': [
      'error',
      {
        prefix: 'sentry',
        rootDir: 'static/app',
        // TODO(ryan953): Follow up and investigate `allowSameFolder`, maybe
        // with exceptions for *.spec.tsx files.
        allowSameFolder: true,
      },
    ],
    'boundaries/dependencies': [
      'error',
      {
        default: 'disallow',
        checkInternals: true,
        message: '{{from.element.type}} is not allowed to import {{to.element.type}}',
        policies: [
          // Package dependencies and import rules govern application and Icons
          // access. Keep the file-level restrictions below in boundaries.
          {
            allow: [
              {
                to: {
                  element: {
                    types: {
                      anyOf: [
                        'sentry*',
                        'getsentry',
                        'gsAdmin',
                        'icons',
                        'search-syntax',
                      ],
                    },
                  },
                },
              },
            ],
          },
          {
            from: {
              element: {
                type: 'gsAdmin',
              },
            },
            disallow: {
              to: {
                file: {
                  categories: 'sentry-locale',
                },
              },
            },
          },
          {
            from: {
              element: {
                type: 'debug-tools',
              },
            },
            allow: [
              {
                to: {
                  element: {
                    type: 'debug-tools',
                  },
                },
              },
            ],
          },
          {
            from: {
              element: {
                type: 'oxlint',
              },
            },
            allow: [
              {
                to: {
                  element: {
                    type: 'oxlint',
                  },
                },
              },
            ],
          },
          // Storybook can load story files and shared test fixtures.
          storyFilesPolicy,
          {
            from: {
              file: {
                categories: 'configs',
              },
            },
            allow: [
              {
                to: {
                  file: {
                    categories: 'configs',
                  },
                },
              },
              {
                to: {
                  element: {
                    type: 'build-utils',
                  },
                },
              },
            ],
          },
          // Test files and test support may use each other, but production files
          // must not import either category.
          {
            disallow: {
              from: {
                file: [
                  {
                    isUnknown: true,
                    isIgnored: false,
                  },
                  {
                    categories: {
                      noneOf: ['test', 'test-support'],
                    },
                    isIgnored: false,
                  },
                ],
              },
              to: {
                file: {
                  categories: {
                    anyOf: ['test', 'test-support'],
                  },
                },
              },
            },
          },
          {
            from: [
              {
                element: {
                  type: 'test',
                },
              },
              {
                file: {
                  categories: {
                    anyOf: ['test', 'test-support'],
                  },
                },
              },
            ],
            allow: [
              {
                to: {
                  element: {
                    type: 'test',
                  },
                },
              },
              {
                to: {
                  file: {
                    categories: {
                      anyOf: ['test', 'test-support'],
                    },
                  },
                },
              },
            ],
          },
          // Deny every Scraps implementation file first. The public-interface
          // and Scraps-internal policies below selectively reopen intended paths.
          {
            message:
              '{{from.element.type}} can import scraps only through public index files; "{{to.element.fileInternalPath}}" is an internal scraps implementation file',
            disallow: {
              to: {
                element: {
                  type: 'scraps',
                },
              },
            },
          },
          {
            allow: [
              {
                to: {
                  element: {
                    type: 'scraps',
                    fileInternalPath: [
                      '**/index.{ts,tsx}',
                      '!(*.{spec,test,snapshots}).{js,mjs,ts,jsx,tsx}',
                    ],
                  },
                },
              },
            ],
          },
          {
            from: {
              element: {
                type: 'scraps',
              },
            },
            allow: [
              {
                to: {
                  element: {
                    type: 'scraps',
                  },
                },
              },
            ],
          },
          // Scraps must not import the legacy locale module. Use useTranslation()
          // from the scraps translation context instead.
          {
            from: {
              element: {
                type: 'scraps',
              },
            },
            disallow: {
              to: {
                file: {
                  categories: 'sentry-locale',
                },
              },
            },
            message:
              'Scraps components must use useTranslation() instead of importing from sentry/locale',
          },
          // Track Scraps interactions through the injected tracking context
          // instead of coupling components to Sentry's analytics module.
          {
            from: {
              element: {
                type: 'scraps',
              },
            },
            disallow: {
              to: {
                file: {
                  path: 'static/app/utils/analytics.tsx',
                },
              },
            },
            message:
              'Scraps components must use the tracking context instead of importing from sentry/utils/analytics',
          },
          // Apply story access after Scraps policies so core stories stay
          // accessible to Storybook, but production code cannot import them.
          {
            disallow: {
              from: {
                file: [
                  {
                    isUnknown: true,
                    isIgnored: false,
                  },
                  {
                    categories: {
                      noneOf: ['story-files'],
                    },
                    isIgnored: false,
                  },
                ],
              },
              to: {
                file: {
                  categories: 'story-files',
                },
              },
            },
          },
          storyFilesPolicy,
        ],
      },
    ],
    'boundaries/no-unknown-files': 'error',
  },
  overrides: [
    {
      files: [
        'tests/js/jestWorkspaceResolver.cjs',
        'tests/js/jestWorkspaceResolver.spec.ts',
      ],
      env: {node: true},
      rules: {'import/no-nodejs-modules': 'off'},
    },
    typescriptOverride,
    {
      files: [
        'oxlint.base.ts',
        'stylelint.base.js',
        '*.config.*',
        '**/__mocks__/*',
        'static/app/stories/*Loader.ts',
        'static/app/chartcuterie/config.tsx',
        'static/oxlint/eslintPluginSentry/index.ts',
        'static/oxlint/eslintPluginScraps/index.ts',
        'static/oxlint/oxlintCompat/*.ts',
        'tests/js/*-transform.*',
        'tests/js/test-*/*',
      ],
      rules: {
        '@sentry/no-default-exports': 'off',
      },
    },
    {
      files: ['static/app/serviceWorker/worker/**/*.ts'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: restrictedImportPatterns,
            paths: restrictedImportPaths.filter(({name}) => name !== '@sentry/browser'),
          },
        ],
        'import-js/no-extraneous-dependencies': 'off',
      },
    },
    {
      files: ['static/app/chartcuterie/**/*.{ts,tsx}'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              ...restrictedImportPatterns,
              // Chartcuterie renders server-side. Browser-only application
              // hooks and stores are unavailable in the rendering service.
              {
                group: [
                  'sentry/utils/use*',
                  'sentry/stores/*',
                  'sentry/actionCreators/*',
                ],
                message: CHARTCUTERIE_MESSAGE,
              },
            ],
            paths: [
              ...restrictedImportPaths,
              {name: 'react', message: CHARTCUTERIE_MESSAGE},
              {name: 'react-dom', message: CHARTCUTERIE_MESSAGE},
              {name: 'react-dom/client', message: CHARTCUTERIE_MESSAGE},
              {name: 'react-dom/server', message: CHARTCUTERIE_MESSAGE},
              {name: '@sentry/react', message: CHARTCUTERIE_MESSAGE},
            ],
          },
        ],
      },
    },
    testOverride,
    effectOverride,
    configOverride,
    {
      files: ['tests/js/fixtures/*.{ts,js,tsx,jsx}'],
      rules: {
        '@sentry/no-calling-components-as-functions': 'off',
      },
    },
    // The lint plugins are standalone packages loaded by oxlint itself, so none
    // of the `sentry/*` aliases resolve inside them.
    {
      files: ['static/oxlint/**/*.{js,mjs,ts,jsx,tsx}'],
      rules: {
        'import/no-relative-parent-imports': 'off',
      },
    },
    // Legacy app core components still use parent-relative imports.
    {
      files: ['static/app/components/core/**/*.{js,mjs,ts,jsx,tsx}'],
      rules: {
        'import/no-relative-parent-imports': 'off',
      },
    },
    // Build scripts run outside the app bundle and are kept as bare as
    // possible, so they reach for source with a plain relative path.
    {
      files: ['scripts/**/*.{js,mjs,ts,jsx,tsx}'],
      rules: {
        'import/no-relative-parent-imports': 'off',
      },
    },
    {
      files: [
        'static/packages/scraps/*.config.mjs',
        'static/packages/icons/*.config.mjs',
      ],
      rules: {'boundaries/no-unknown-files': 'off'},
    },
    {
      files: ['static/packages/*/oxlint.config.ts'],
      rules: {
        'boundaries/no-unknown-files': 'off',
        'import/no-relative-parent-imports': 'off',
        'import-js/no-relative-packages': 'off',
      },
    },
    {
      files: [
        'static/oxlint/**/*.js',
        'scripts/**/*.{js,ts}',
        'tests/js/test-balancer/*.ts',
      ],
      rules: {
        'no-console': 'off',
        'import/no-nodejs-modules': 'off',
      },
      env: {
        node: true,
      },
    },
    {
      files: [
        'tests/js/bin/*.mjs',
        'tests/js/createJestConfig.ts',
        'tests/js/jest-pegjs-transform.js',
        'tests/js/sentry-test/jest-environment.cjs',
        'tests/js/sentry-test/jest-environment-node.cjs',
        'tests/js/sentry-test/wrapWithStructuredClone.cjs',
        'tests/js/sentry-test/mocks/*',
        'tests/js/sentry-test/loadFixtures.ts',
        'tests/js/sentry-test/runner.ts',
        'tests/js/setup.ts',
      ],
      rules: {
        'import/no-nodejs-modules': 'off',
      },
      env: {
        node: true,
      },
    },
    // These widgets are the intended public entry points for the restricted
    // insights widget implementations.
    {
      files: ['static/app/views/insights/common/components/widgets/*.tsx'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: [restrictedConventionsImportPattern],
            // Allow these implementations only through the public widgets in
            // the directory selected by this override.
            paths: restrictedImportPaths.filter(
              ({name}) =>
                ![
                  'sentry/views/insights/common/components/insightsLineChartWidget',
                  'sentry/views/insights/common/components/insightsAreaChartWidget',
                  'sentry/views/insights/common/components/insightsTimeSeriesWidget',
                ].includes(name)
            ),
          },
        ],
      },
    },
    {
      files: coreComponentFiles,
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              ...restrictedImportPatterns,
              {
                group: ['csstype', 'csstype/*'],
                message: CSS_TYPES_MESSAGE,
              },
            ],
            // The core component package owns this dependency.
            paths: restrictedImportPaths.filter(({name}) => name !== 'color'),
          },
        ],
      },
    },
    {
      files: ['**/*.figma.{tsx,jsx}'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: [restrictedConventionsImportPattern],
            // Figma Code Connect is valid only in its generated integration files.
            paths: restrictedImportPaths.filter(
              ({name}) => name !== '@figma/code-connect'
            ),
          },
        ],
      },
    },
    {
      files: testFiles,
      rules: {
        // Tests sometimes contain intentionally unusual hard-coded numbers.
        'no-loss-of-precision': 'off',
        '@sentry/prefer-react-component': 'off',
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
      files: [
        'static/packages/scraps/src/**/*.spec.tsx',
        'static/packages/scraps/test/**/*.{ts,tsx,mjs}',
        'static/packages/icons/src/**/*.spec.tsx',
        'static/packages/icons/test/**/*.{ts,tsx,mjs}',
      ],
      rules: {
        'import/no-nodejs-modules': 'off',
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              ...restrictedImportPatterns,
              {
                group: ['sentry/*', 'sentry-test/*', 'sentry-fixture/*'],
                message: 'Package tests must be independent of the Sentry application.',
              },
            ],
            paths: restrictedImportPaths.filter(
              ({name}) => !name.startsWith('@testing-library/')
            ),
          },
        ],
      },
    },
    storyOverride,
    // Keep lint-disable comments out of this SDK source because users consume
    // the file directly.
    {
      files: ['**/js-sdk-loader.ts'],
      rules: {
        'no-console': 'off',
      },
    },
    {
      files: ['static/gsApp/**/*.{js,mjs,ts,jsx,tsx}'],
      rules: {
        '@sentry/no-relative-import-paths': [
          'error',
          {
            prefix: 'getsentry',
            rootDir: 'static/gsApp',
            // TODO(ryan953): Follow up and investigate `allowSameFolder`, maybe
            // with exceptions for *.spec.tsx files.
            allowSameFolder: true,
          },
        ],
      },
    },
    {
      files: ['static/gsAdmin/**/*.{js,mjs,ts,jsx,tsx}'],
      rules: {
        '@sentry/no-relative-import-paths': [
          'error',
          {
            prefix: 'admin',
            rootDir: 'static/gsAdmin',
            // TODO(ryan953): Follow up and investigate `allowSameFolder`, maybe
            // with exceptions for *.spec.tsx files.
            allowSameFolder: true,
          },
        ],
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              ...restrictedImportPatterns,
              {
                group: ['sentry/locale'],
                message: 'Do not import locale into gsAdmin. No translations required.',
              },
            ],
            paths: restrictedImportPaths,
          },
        ],
      },
    },
    // GetSentry fixtures contain GetSentry types and need the same access as
    // tests under static/gsApp.
    {
      files: ['tests/js/getsentry-test/**/*.{js,mjs,ts,jsx,tsx}'],
      rules: {
        'no-restricted-imports': 'off',
      },
    },
    {
      files: coreComponentFiles,
      rules: coreComponentRules,
      excludeFiles: ['**/*.spec.{js,mjs,ts,jsx,tsx}'],
    },
    ...incubator.overrides,
  ],
});

const enrolledRules = new Set(
  [incubator, ...incubator.overrides].flatMap(({rules}) =>
    Object.entries(rules ?? {})
      .filter(([, options]) => {
        const severity = Array.isArray(options) ? options[0] : options;
        return severity !== 'off' && severity !== 0;
      })
      .map(([rule]) => rule)
  )
);
function setIncubatorSeverity(rules: OxlintConfig['rules']) {
  const configured = {...rules};
  const severity = process.env.SENTRY_OXLINT_ENFORCE === 'true' ? 'error' : 'warn';
  for (const [rule, options] of Object.entries(configured)) {
    const current = Array.isArray(options) ? options[0] : options;
    if (!enrolledRules.has(rule) || current === 'off' || current === 0) {
      continue;
    }
    const next = typeof current === 'number' ? (severity === 'error' ? 2 : 1) : severity;
    if (Array.isArray(options)) {
      const updated = structuredClone(options);
      updated[0] = next;
      configured[rule] = updated;
    } else {
      configured[rule] = next;
    }
  }
  return configured;
}
export default defineConfig({
  ...config,
  rules: setIncubatorSeverity({
    ...Object.fromEntries(
      Object.entries(config.rules).filter(([rule]) => !enrolledRules.has(rule))
    ),
    ...incubator.rules,
  }),
  overrides: config.overrides.map(override => ({
    ...override,
    rules: setIncubatorSeverity(override.rules),
  })),
});
