import typescript from 'typescript-eslint';

export default typescript.config([
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx', '**/*.mjs'],
    languageOptions: {
      parser: typescript.parser,
    },
    rules: {
      'no-console': 'error',
    },
  },
]);
