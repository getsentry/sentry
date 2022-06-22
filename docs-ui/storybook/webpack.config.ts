/* eslint-env node */
/* eslint import/no-nodejs-modules:0 */

import path from 'path';

import webpack from 'webpack';

import appConfig from '../../webpack.config';

const staticPath = path.resolve(__dirname, '..', '..', 'static', 'app');
const docsUiPath = path.resolve(__dirname, '..');

/**
 * Default the config parameter that storybook passes into our webpack config
 * to an empty object specifically for eslint, since it will load this config
 * without passing in a config object.
 */
const emptyConfig: webpack.Configuration = {
  module: {rules: []},
  resolve: {alias: {}, extensions: []},
  plugins: [],
};

type Opts = {
  config: webpack.Configuration;
};

const configBuilder = ({config}: Opts = {config: emptyConfig}) => {
  const [firstRule, ...rules] = (config.module?.rules ?? []) as webpack.RuleSetRule[];

  const filteredRules = rules.filter(rule => {
    const isFileLoader = !!rule?.loader?.includes('file-loader');

    const isPostCssLoader =
      Array.isArray(rule.use) &&
      rule.use.find(
        use => typeof use === 'object' && use?.loader?.includes('postcss-loader')
      );

    return !isFileLoader && !isPostCssLoader;
  });

  const extensions = new Set([
    ...(config.resolve?.extensions ?? []),
    ...(appConfig.resolve?.extensions ?? []),
  ]);

  const newConfig: webpack.Configuration = {
    ...config,
    module: {
      ...config.module,
      rules: [
        {
          ...firstRule,
          test: /\.(mjs|[tj]sx?)$/,
          include: [staticPath, docsUiPath],
        },
        {
          test: /\.less$/,
          use: ['style-loader', 'css-loader', 'less-loader'],
        },
        {
          test: /\.pegjs/,
          use: {loader: 'pegjs-loader'},
        },
        {
          test: /\.(woff|woff2|ttf|eot|svg|png|gif|ico|jpg)($|\?)/,
          type: 'asset/resource',
        },
        {
          test: /\.po$/,
          use: {
            loader: 'po-catalog-loader',
            options: {
              referenceExtensions: ['.js', '.jsx'],
              domain: 'sentry',
            },
          },
        },
        ...filteredRules,
      ],
    },

    plugins: [
      ...(config.plugins ?? []),
      new webpack.ProvidePlugin({jQuery: 'jquery'}),
      new webpack.DefinePlugin({'process.env.FIXED_DYNAMIC_CONTENT': true}),
    ],

    resolve: {
      ...config.resolve,
      extensions: Array.from(extensions),
      alias: {
        ...config.resolve?.alias,
        ...appConfig.resolve?.alias,
        'docs-ui': docsUiPath,
      },
      fallback: {
        ...appConfig.resolve?.fallback,
        // XXX(epurkhiser): As per [0] assert is required for
        // @storybook/addons-docs, but seems we can just noop the polyfill.
        //
        // [0]: https://gist.github.com/shilman/8856ea1786dcd247139b47b270912324#gistcomment-3681971
        assert: false,
      },
    },
  };

  return newConfig;
};

export default configBuilder;
