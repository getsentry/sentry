import typescript from 'typescript-eslint';

import configs from './eslint.config.mjs';

export default typescript.config([
  ...configs,
  {
    name: 'eslint/global/languageOptionsWithoutProjectService',
    languageOptions: {
      parserOptions: {
        projectService: false,
      },
    },
  },
  {
    extends: [typescript.configs.disableTypeChecked],
  },
]);
