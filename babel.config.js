/*eslint-env node*/
module.exports = {
  presets: [
    '@babel/react',
    '@babel/env',
    '@babel/preset-typescript',
    [
      '@emotion/babel-preset-css-prop',
      {
        autoLabel: true,
        sourceMap: false,
        labelFormat: '[local]',
      },
    ],
  ],
  plugins: [
    '@babel/plugin-syntax-dynamic-import',
    '@babel/plugin-proposal-object-rest-spread',
    '@babel/plugin-transform-runtime',
    // NOTE: The order of the decorator and class-property plugins is important
    // here. Decorators must be processed first before class properties, see:
    // https://babeljs.io/docs/en/plugins#plugin-ordering
    ['@babel/plugin-proposal-decorators', {legacy: true}],
    ['@babel/plugin-proposal-class-properties', {loose: true}],
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
      presets: [
        [
          '@emotion/babel-preset-css-prop',
          {
            autoLabel: true,
            sourceMap: false,
          },
        ],
      ],
      plugins: [
        '@babel/plugin-transform-react-jsx-source',
        !!process.env.SENTRY_UI_HOT_RELOAD ? 'react-refresh/babel' : null,
      ].filter(Boolean),
    },
    test: {
      plugins: ['dynamic-import-node'],
    },
  },
};
