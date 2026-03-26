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
      code: `
export function MyComponentInner() { return <div />; }
export default wrap(MyComponentInner);
`,
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
    {
      code: `
        export const a = 1;
        export const b = 2;
      `,
      filename: 'valid.tsx',
    },
    {
      code: `export class MyClass {}`,
      filename: 'valid.tsx',
    },
    {
      code: `const x = 1;`,
      filename: 'valid.tsx',
    },
    {
      code: `export default withConfig(MyComponent);`,
      filename: 'valid.tsx',
    },
    {
      code: `export default styled(MyComponent)\`color: red;\`;`,
      filename: 'valid.tsx',
    },
    {
      code: `export default withConfig(MyComponent) as React.FC;`,
      filename: 'valid.tsx',
    },
  ],
  invalid: [
    {
      code: `
        function example() {}
        export default example;
      `,
      output: `
        export function example() {}
      `,
      errors: [{messageId: 'forbidden'}],
      filename: 'invalid.tsx',
    },
    {
      code: `
        export function alsoExported() {}
        export default function defaultExported() {}
      `,
      output: `
        export function alsoExported() {}
        export function defaultExported() {}
      `,
      errors: [{messageId: 'forbidden'}],
      filename: 'invalid.tsx',
    },
    {
      code: `
        function MyComponent() { return <div />; }
        export default MyComponent;
      `,
      output: `
        export function MyComponent() { return <div />; }
      `,
      errors: [{messageId: 'forbidden'}],
      filename: 'invalid.tsx',
    },
    {
      code: `
        const Panel = styled('div')\`padding: 0;\`;
        export default Panel;
      `,
      output: `
        export const Panel = styled('div')\`padding: 0;\`;
      `,
      errors: [{messageId: 'forbidden'}],
      filename: 'invalid.tsx',
    },
    {
      code: `
        const MyComponent = () => <div />;
        export default MyComponent;
      `,
      output: `
        export const MyComponent = () => <div />;
      `,
      errors: [{messageId: 'forbidden'}],
      filename: 'invalid.tsx',
    },
    {
      code: `
        class MyComponent extends React.Component {};
        export default MyComponent;
      `,
      output: `
        export class MyComponent extends React.Component {};
      `,
      errors: [{messageId: 'forbidden'}],
      filename: 'invalid.tsx',
    },
    {
      code: `
        enum MyShape {};
        export default MyShape;
      `,
      output: `
        export enum MyShape {};
      `,
      errors: [{messageId: 'forbidden'}],
      filename: 'invalid.tsx',
    },
    {
      code: `
        interface MyShape {};
        export default MyShape;
      `,
      output: `
        export interface MyShape {};
      `,
      errors: [{messageId: 'forbidden'}],
      filename: 'invalid.tsx',
    },
    {
      code: `
        type MyShape = {};
        export default MyShape;
      `,
      output: `
        export type MyShape = {};
      `,
      errors: [{messageId: 'forbidden'}],
      filename: 'invalid.tsx',
    },
    {
      code: `
        let count = 0;
        export default count;
      `,
      output: `
        export let count = 0;
      `,
      errors: [{messageId: 'forbidden'}],
      filename: 'invalid.tsx',
    },
    {
      code: `export default function myFunction() { return 1; }`,
      output: `export function myFunction() { return 1; }`,
      errors: [{messageId: 'forbidden'}],
      filename: 'invalid.tsx',
    },
    {
      code: `export default class MyClass {}`,
      output: `export class MyClass {}`,
      errors: [{messageId: 'forbidden'}],
      filename: 'invalid.tsx',
    },
    {
      code: `export default function() { return 1; }`,
      errors: [{messageId: 'forbidden'}],
      filename: 'invalid.tsx',
    },
    {
      code: `export default class {}`,
      errors: [{messageId: 'forbidden'}],
      filename: 'invalid.tsx',
    },
    {
      code: `
        const x = 1;
        export default x as number;
      `,
      output: `
        export const x = 1;
      `,
      errors: [{messageId: 'forbidden'}],
      filename: 'invalid.tsx',
    },
    {
      code: `
        function myFn() {}
        export default myFn as unknown as () => void;
      `,
      output: `
        export function myFn() {}
      `,
      errors: [{messageId: 'forbidden'}],
      filename: 'invalid.tsx',
    },
    {
      code: `export default { key: "value" };`,
      errors: [{messageId: 'forbidden'}],
      filename: 'invalid.tsx',
    },
    {
      code: `export default [1, 2, 3];`,
      errors: [{messageId: 'forbidden'}],
      filename: 'invalid.tsx',
    },
    {
      code: `export default "hello";`,
      errors: [{messageId: 'forbidden'}],
      filename: 'invalid.tsx',
    },
    {
      code: `export default 42;`,
      errors: [{messageId: 'forbidden'}],
      filename: 'invalid.tsx',
    },
    {
      code: `export default () => null;`,
      errors: [{messageId: 'forbidden'}],
      filename: 'invalid.tsx',
    },
    {
      code: `
        const a = 1, b = 2;
        export default b;
      `,
      output: `
        export const a = 1, b = 2;
      `,
      errors: [{messageId: 'forbidden'}],
      filename: 'invalid.tsx',
    },
    {
      code: `
        export const a = 1;
        export default function foo() {}
      `,
      output: `
        export const a = 1;
        export function foo() {}
      `,
      errors: [{messageId: 'forbidden'}],
      filename: 'invalid.tsx',
    },
    {
      code: `
        export const a = 1;
        function bar() {}
        export default bar;
      `,
      output: `
        export const a = 1;
        export function bar() {}
      `,
      errors: [{messageId: 'forbidden'}],
      filename: 'invalid.tsx',
    },
  ],
});
