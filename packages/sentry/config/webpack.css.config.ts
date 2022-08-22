/* eslint-env node */
/* eslint import/no-nodejs-modules:0 */

import config from '../webpack.config';

// Select all CSS rules from the base webpack config
const cssRules =
  config?.module?.rules?.filter(
    ruleSet =>
      typeof ruleSet === 'object' &&
      ['/\\.css/', '/\\.less$/'].includes(ruleSet.test?.toString() ?? '')
  ) ?? [];

config.entry = {
  sentry: 'less/jest-ci.less',
};

config.module = {
  ...config?.module,
  rules: [
    ...cssRules,
    {
      test: /\.(jpe?g|png|gif|ttf|eot|svg|woff(2)?)(\?[a-z0-9=&.]+)?$/,
      use: [
        {
          loader: 'url-loader',
          options: {esModule: false, limit: true},
        },
      ],
    },
  ],
};

export default config;
