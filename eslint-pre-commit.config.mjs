import typescript from 'typescript-eslint';

import configs, {typeAwareLintRules} from './eslint.config.mjs';

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
    name: typeAwareLintRules.name,
    rules: Object.fromEntries(
      Object.entries(typeAwareLintRules.rules).map(([key]) => [key, 'off'])
    ),
  },
]);
