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

module.exports = {
  webpack: config => {
    console.log(config);
    return {
      ...config,
      module: {
        ...config.module,
        rules: [
          // {
          // test: /\.stories\.tsx?$/,
          // loaders: [
          // {
          // loader: require.resolve('@storybook/source-loader'),
          // options: {parser: 'typescript'},
          // },
          // ],
          // enforce: 'pre',
          // },
          {
            test: /\.tsx?$/,
            loader: 'ts-loader',
          },
          {
            test: /\.po$/,
            loader: 'po-catalog-loader',
            query: {
              referenceExtensions: ['.js', '.jsx'],
              domain: 'sentry',
            },
          },
          {
            test: /\.css$/,
            use: ['style-loader', 'css-loader'],
          },
          {
            test: /app\/icons\/.*\.svg$/,
            use: [
              {
                loader: 'svg-sprite-loader',
              },
              {
                loader: 'svgo-loader',
              },
            ],
          },
          {
            test: /\.less$/,
            use: [
              {
                loader: 'style-loader',
              },
              {
                loader: 'css-loader',
              },
              {
                loader: 'less-loader',
              },
            ],
          },
          {
            test: /\.(woff|woff2|ttf|eot|svg|png|gif|ico|jpg)($|\?)/,
            exclude: /app\/icons\/.*\.svg$/,
            loader: 'file-loader?name=' + '[name].[ext]',
          },
        ],
      },

      plugins: [
        ...config.plugins,
        new webpack.ProvidePlugin({
          $: 'jquery',
          jQuery: 'jquery',
          'window.jQuery': 'jquery',
          'root.jQuery': 'jquery',
          underscore: 'underscore',
          _: 'underscore',
        }),
        new webpack.DefinePlugin({
          'process.env': {
            IS_PERCY: true,
          },
        }),
      ],

      resolve: {
        ...config.resolve,
        extensions: appConfig.resolve.extensions,
        alias: Object.assign({}, appConfig.resolve.alias, {
          app: staticPath,
        }),
      },
    };
  },
};
