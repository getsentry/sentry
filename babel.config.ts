/* eslint-env node */

import {TransformOptions} from '@babel/core';

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
    '@babel/preset-typescript',
  ],
  overrides: [],
  plugins: [
    '@emotion/babel-plugin',
    '@babel/plugin-transform-runtime',
    '@babel/plugin-transform-class-properties',
  ],
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
        ['@fullstory/babel-plugin-annotate-react'],
      ],
    },
    development: {
      plugins: [
        '@emotion/babel-plugin',
        '@babel/plugin-transform-react-jsx-source',
        ['@fullstory/babel-plugin-annotate-react'],
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
