/* eslint-env node */

import type {TransformOptions} from '@babel/core';

const config: TransformOptions = {
  presets: [
    [
      '@babel/preset-react',
      {
        runtime: 'automatic',
        importSource: '@emotion/react',
      },
    ],
    [
      '@babel/preset-env',
      {
        useBuiltIns: 'usage',
        corejs: '3.27',
      },
    ],
    // TODO: Remove allowDeclareFields when we upgrade to Babel 8
    ['@babel/preset-typescript', {allowDeclareFields: true}],
  ],
  overrides: [],
  plugins: ['@emotion/babel-plugin', '@babel/plugin-transform-runtime'],
  env: {
    production: {
      plugins: [
        [
          'transform-react-remove-prop-types',
          {
            mode: 'remove', // remove from bundle
            removeImport: true, // removes `prop-types` import statements
            classNameMatchers: [
              'SelectField',
              'FormField',
              'DeprecatedAsyncComponent',
              'DeprecatedAsyncView',
            ],
            additionalLibraries: [/app\/sentryTypes$/],
          },
        ],
        ['babel-plugin-add-react-displayname'],
        '@sentry/babel-plugin-component-annotate',
      ],
    },
    development: {
      plugins: [
        '@emotion/babel-plugin',
        '@babel/plugin-transform-react-jsx-source',
        '@sentry/babel-plugin-component-annotate',
        ...(process.env.SENTRY_UI_HOT_RELOAD ? ['react-refresh/babel'] : []),
      ],
    },
    test: {
      sourceMaps: process.env.CI ? false : true,
      plugins: [
        // Required, see https://github.com/facebook/jest/issues/9430
        'dynamic-import-node',
        // Disable emotion sourcemaps in tests
        // Since emotion spends lots of time parsing and inserting sourcemaps
        [
          '@emotion/babel-plugin',
          {
            sourceMap: false,
          },
        ],
      ],
    },
  },
};

export default config;
