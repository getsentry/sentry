import {definePlugin} from '@oxlint/plugins';

import {rules} from './src/rules/index.ts';

export {rules};

const scrapsPlugin = definePlugin({
  meta: {
    name: '@sentry-internal/eslint-plugin-scraps',
  },
  rules,
});

export default scrapsPlugin;
