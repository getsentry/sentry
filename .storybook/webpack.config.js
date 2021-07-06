/* eslint-env node */
/* eslint import/no-nodejs-modules:0 */
const path = require('path');
const webpack = require('webpack');
const appConfig = require('../webpack.config');

const staticPath = path.resolve(__dirname, '..', 'static', 'app');

/**
 * Default the config parameter that storybook passes into our webpack config
 * to an empty object specifically for eslint, since it will load this config
 * without passing in a config object.
 */
const emptyConfig = {
  module: {rules: []},
  resolve: {alias: {}, extensions: []},
  plugins: [],
};

module.exports = ({config} = {config: emptyConfig}) => {
  const [firstRule, ...rules] = config.module.rules;

  const filteredRules = rules.filter(rule => {
    return (
      (!rule.loader || !rule.loader.includes('file-loader')) &&
      (!Array.isArray(rule.use) ||
        !rule.use.find(({loader}) => loader && loader.includes('postcss-loader')))
    );
  });

  const newConfig = {
    ...config,
    module: {
      ...config.module,
      rules: [
        {
          ...firstRule,
          test: /\.(mjs|[tj]sx?)$/,
          include: [path.join(__dirname), staticPath, path.join(__dirname, '../docs-ui')],
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
      ...config.plugins,
      new webpack.ProvidePlugin({
        jQuery: 'jquery',
      }),
      new webpack.DefinePlugin({
        'process.env.FIXED_DYNAMIC_CONTENT': true,
      }),
    ],

    resolve: {
      ...config.resolve,
      extensions: Array.from(
        new Set([...config.resolve.extensions, ...appConfig.resolve.extensions])
      ),
      alias: {
        ...config.resolve.alias,
        ...appConfig.resolve.alias,
        app: staticPath,
      },
      fallback: {
        ...appConfig.resolve.fallback,
        // XXX(epurkhiser): As per [0] assert is required for
        // @storybook/addons-docs, but seems we can just noop the pollyfill.
        //
        // [0]: https://gist.github.com/shilman/8856ea1786dcd247139b47b270912324#gistcomment-3681971
        assert: false,
      },
    },
  };

  return newConfig;
};
