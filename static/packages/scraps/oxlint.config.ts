import {
  createPackageConfig,
  coreComponentRules,
  CSS_TYPES_MESSAGE,
  packageImports,
} from '../../../oxlint.base.ts';

export default createPackageConfig(import.meta.dirname, {
  rules: {'import/no-relative-parent-imports': 'off'},
  overrides: [
    {
      files: ['src/**/*.{ts,tsx}'],
      // Retain the existing exception during the config migration.
      rules: {'no-shadow': 'off'},
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
      files: ['scripts/*.mjs'],
      env: {node: true},
      rules: {
        'import-js/no-extraneous-dependencies': 'off',
        'import/no-nodejs-modules': 'off',
        'no-console': 'off',
      },
    },
  ],
});
