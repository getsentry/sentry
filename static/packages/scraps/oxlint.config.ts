import {
  createPackageConfig,
  coreComponentRules,
  CSS_TYPES_MESSAGE,
  packageImports,
  restrictedSyntax,
} from '../../../oxlint.base.ts';

const SCRAPS_PROCESS_MESSAGE =
  'Scraps runs in browsers without `process`. Only `process.env.NODE_ENV` is allowed; let the app pass other configuration in.';

export default createPackageConfig(import.meta.dirname, {
  overrides: [
    {
      files: ['src/**/*.{ts,tsx}'],
      // Retain the existing exception during the config migration.
      rules: {
        '@sentry/no-global-react': 'error',
        'no-shadow': 'off',
        'eslint-js/no-restricted-syntax': [
          'error',
          ...restrictedSyntax,
          {
            // Scraps is published for browsers, where `process` is undefined.
            // Bundlers only replace `process.env.NODE_ENV` consistently.
            selector:
              "Identifier[name='process']:not(MemberExpression > Identifier.property, Property > Identifier.key, MemberExpression[property.name='NODE_ENV'] > MemberExpression.object[property.name='env'] > Identifier.object)",
            message: SCRAPS_PROCESS_MESSAGE,
          },
          {
            selector:
              "MemberExpression[object.name=/^(globalThis|self|window)$/][property.name='process']",
            message: SCRAPS_PROCESS_MESSAGE,
          },
        ],
      },
    },
    {
      files: ['src/**/*.{ts,tsx}'],
      excludeFiles: ['**/*.spec.{ts,tsx}'],
      rules: {
        ...coreComponentRules,
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              ...packageImports.patterns,
              {group: ['csstype', 'csstype/*'], message: CSS_TYPES_MESSAGE},
            ],
            paths: packageImports.paths.filter(({name}) => name !== 'color'),
          },
        ],
      },
    },
    {
      files: ['src/**/*.spec.{ts,tsx}', 'test/**/*.{ts,tsx,mjs}'],
      rules: {'import/no-relative-parent-imports': 'off'},
    },
  ],
});
