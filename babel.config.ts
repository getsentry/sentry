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
        corejs: '3.37',
      },
    ],
    // TODO: Remove allowDeclareFields when we upgrade to Babel 8
    ['@babel/preset-typescript', {allowDeclareFields: true}],
  ],
  overrides: [],
  plugins: ['@emotion/babel-plugin', '@babel/plugin-transform-runtime'],
  env: {
    production: {},
    development: {
      plugins: [
        '@emotion/babel-plugin',
        ...(process.env.SENTRY_UI_HOT_RELOAD ? ['react-refresh/babel'] : []),
      ],
    },
    test: {
      sourceMaps: process.env.CI ? false : true,
      plugins: [
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
