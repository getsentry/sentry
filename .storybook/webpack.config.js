/*eslint-env node*/
/*eslint import/no-nodejs-modules:0 */
const path = require('path');
const webpack = require('webpack');
const appConfig = require('../webpack.config');

const staticPath = path.resolve(
  __dirname,
  '..',
  'src',
  'sentry',
  'static',
  'sentry',
  'app'
);

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
          test: /\.css$/,
          use: ['style-loader', 'css-loader'],
        },
        {
          test: /\.less$/,
          use: ['style-loader', 'css-loader', 'less-loader'],
        },
        {
          test: /\.(woff|woff2|ttf|eot|svg|png|gif|ico|jpg)($|\?)/,
          use: [
            {
              loader: 'file-loader',
              options: {
                esModule: false,
                name: '[name].[hash:6].[ext]',
              },
            },
          ],
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
        'process.env': {
          FIXED_DYNAMIC_CONTENT: true,
        },
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
      },
    },
  };

  return newConfig;
};
