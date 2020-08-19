/*eslint-env node*/
/*eslint import/no-nodejs-modules:0 */
const config = require('../webpack.config');

config.entry = {
  sentry: 'less/jest-ci.less',
};
config.module = {
  ...config.module,
  rules: [
    ...config.module.rules.filter(({test}) =>
      ['/\\.css/', '/\\.less$/'].includes(test.toString())
    ),

    {
      test: /\.(jpe?g|png|gif|ttf|eot|svg|woff(2)?)(\?[a-z0-9=&.]+)?$/,
      use: 'base64-inline-loader?limit=10000&name=[name].[ext]',
    },
  ],
};

module.exports = config;
