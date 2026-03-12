import {RuleTester} from '@typescript-eslint/rule-tester';

import {noDefaultExports} from './no-default-exports';

const ruleTester = new RuleTester({
  languageOptions: {
    parserOptions: {
      projectService: {
        allowDefaultProject: ['*.ts', '*.tsx', 'static/app/*.ts', 'static/app/*.tsx'],
      },
      tsconfigRootDir: __dirname,
    },
  },
});

ruleTester.run('no-default-exports', noDefaultExports, {
  valid: [
    {
      code: `export function MyComponent() { return <div />; }`,
      filename: 'valid.tsx',
    },
    {
      code: `export const MyComponent = () => <div />;`,
      filename: 'valid.tsx',
    },
    {
      code: `export const util = () => null;`,
      filename: 'valid.tsx',
    },
  ],
  invalid: [
    {
      code: 'function example() {}\nexport default example;',
      output: 'export function example() {}\n',
      errors: [{messageId: 'forbidden'}],
      filename: 'invalid.tsx',
    },
    {
      code: 'function MyComponent() { return <div />; }\nexport default MyComponent;',
      output: 'export function MyComponent() { return <div />; }\n',
      errors: [{messageId: 'forbidden'}],
      filename: 'invalid.tsx',
    },
    {
      code: `const Panel = styled('div')\`padding: 0;\`;
export default Panel;`,
      output: `export const Panel = styled('div')\`padding: 0;\`;
`,
      errors: [{messageId: 'forbidden'}],
      filename: 'invalid.tsx',
    },
  ],
});
