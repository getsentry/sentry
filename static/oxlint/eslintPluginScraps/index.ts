import {rules} from './src/rules/index.ts';

export {rules};

const scrapsPlugin = {
  meta: {
    name: '@sentry-internal/eslint-plugin-scraps',
    version: '1.0.0',
  },
  rules,
};

export default scrapsPlugin;
