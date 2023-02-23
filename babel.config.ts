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
    '@babel/plugin-proposal-class-properties',
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
              'AsyncComponent',
              'AsyncView',
            ],
            additionalLibraries: [/app\/sentryTypes$/],
          },
        ],
        ['babel-plugin-add-react-displayname'],
      ],
    },
    development: {
      plugins: [
        '@emotion/babel-plugin',
        '@babel/plugin-transform-react-jsx-source',
        ...(process.env.SENTRY_UI_HOT_RELOAD ? ['react-refresh/babel'] : []),
      ],
    },
    test: {
      // Required, see https://github.com/facebook/jest/issues/9430
      plugins: ['dynamic-import-node'],
    },
  },
};

export default config;
