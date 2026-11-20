import {RuleTester} from 'oxlint/plugins-dev';

import {
  collectLazyImportSpecifiers,
  mayContainDynamicImport,
  noDefaultExports,
} from './noDefaultExports';

describe.each([
  ['direct call', "import('component')"],
  ['whitespace', "import \n ('component')"],
  ['block comment', "import /* webpackChunkName: 'component' */ ('component')"],
  ['line comment', "import // component\n ('component')"],
  ['carriage return line comment', "import // component\r ('component')"],
  ['unicode line comment', "import // component\u2028 ('component')"],
  ['multiple comments', "import /* one */ // two\n /* three */ ('component')"],
])('mayContainDynamicImport - %s', (_description, source) => {
  it('detects the import call', () => {
    expect(mayContainDynamicImport(source)).toBe(true);
  });
});

it('does not treat a static import as a dynamic import', () => {
  expect(mayContainDynamicImport("import Component from 'component'")).toBe(false);
});

it('keeps a comment-separated static import as a candidate', () => {
  expect(
    mayContainDynamicImport(
      "import /* webpackMode: 'eager' */ Component from 'component'"
    )
  ).toBe(true);
});

it.each([
  ['block-comment overlap', `import /*${'*//*'.repeat(10_000)}`],
  ['line-comment overlap', `import ${'\r\n//'.repeat(10_000)}`],
])('handles adversarial %s input', (_description, source) => {
  expect(mayContainDynamicImport(source)).toBe(true);
});

it.each([
  ['awaited import', "async function load() { return await import('./component'); }"],
  [
    'parenthesized awaited import',
    "async function load() { return await ((import('./component'))); }",
  ],
  ['arrow import', "const load = () => import('./component');"],
  ['commented arrow import', "const load = () => /* webpack */ import('./component');"],
])('collects a lazy %s', (_description, source) => {
  expect(collectLazyImportSpecifiers(source)).toEqual(['./component']);
});

it.each([
  ['bare import', "import('./component');"],
  ['static import', "import Component from './component';"],
  ['nested arrow expression', "const load = () => ready ? import('./component') : null;"],
  ['chained arrow import', "const load = () => import('./component').then(load);"],
  ['non-literal import', 'const load = () => import(component);'],
  [
    'import with options',
    "const load = () => import('./component', {with: {type: 'json'}});",
  ],
])('does not collect a %s', (_description, source) => {
  expect(collectLazyImportSpecifiers(source)).toEqual([]);
});

it('updates the cached allowlist when a lazy importer is linted again', () => {
  const importer = `${__dirname}/fixtures/lazyImporter.ts`;
  const target = `${__dirname}/fixtures/lazyTarget.ts`;
  const importerSource = "export const load = () => import('./lazyTarget');";
  const targetSource = 'export default function Target() { return null; }';
  const tester = new RuleTester();
  const originalDescribe = RuleTester.describe;
  const originalIt = RuleTester.it;

  // Run every lint pass synchronously inside this one Jest test.
  RuleTester.describe = (_name, run) => run();
  RuleTester.it = (_name, run) => run();
  try {
    tester.run('initial lazy target', noDefaultExports, {
      valid: [{code: targetSource, filename: target}],
      invalid: [],
    });
    tester.run('remove lazy import', noDefaultExports, {
      valid: [{code: 'export const load = () => null;', filename: importer}],
      invalid: [],
    });
    tester.run('target is now forbidden', noDefaultExports, {
      valid: [],
      invalid: [
        {
          code: targetSource,
          filename: target,
          errors: 1,
          output: 'export function Target() { return null; }',
        },
      ],
    });
    tester.run('restore lazy import', noDefaultExports, {
      valid: [{code: importerSource, filename: importer}],
      invalid: [],
    });
    tester.run('target is allowed again', noDefaultExports, {
      valid: [{code: targetSource, filename: target}],
      invalid: [],
    });
  } finally {
    try {
      tester.run('restore lazy importer', noDefaultExports, {
        valid: [{code: importerSource, filename: importer}],
        invalid: [],
      });
    } finally {
      RuleTester.describe = originalDescribe;
      RuleTester.it = originalIt;
    }
  }
});
const ruleTester = new RuleTester();

ruleTester.run('no-default-exports', noDefaultExports, {
  valid: [
    {code: 'export function MyComponent() { return <div />; }', filename: 'valid.tsx'},
    {
      code: `
export function MyComponentInner() { return <div />; }
export default wrap(MyComponentInner);
`,
      filename: 'valid.tsx',
    },
    {code: 'export const MyComponent = () => <div />;', filename: 'valid.tsx'},
    {code: 'export const util = () => null;', filename: 'valid.tsx'},
    {
      code: `
        export const a = 1;
        export const b = 2;
      `,
      filename: 'valid.tsx',
    },
    {code: 'export class MyClass {}', filename: 'valid.tsx'},
    {code: 'const x = 1;', filename: 'valid.tsx'},
    {code: 'export default withConfig(MyComponent);', filename: 'valid.tsx'},
    {code: 'export default styled(MyComponent)`color: red;`;', filename: 'valid.tsx'},
    {code: 'export default withConfig(MyComponent) as React.FC;', filename: 'valid.tsx'},
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
      code: 'export default function myFunction() { return 1; }',
      output: 'export function myFunction() { return 1; }',
      errors: [{messageId: 'forbidden'}],
      filename: 'invalid.tsx',
    },
    {
      code: 'export default class MyClass {}',
      output: 'export class MyClass {}',
      errors: [{messageId: 'forbidden'}],
      filename: 'invalid.tsx',
    },
    {
      code: 'export default function() { return 1; }',
      errors: [{messageId: 'forbidden'}],
      filename: 'invalid.tsx',
    },
    {
      code: 'export default class {}',
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
      code: 'export default { key: "value" };',
      errors: [{messageId: 'forbidden'}],
      filename: 'invalid.tsx',
    },
    {
      code: 'export default [1, 2, 3];',
      errors: [{messageId: 'forbidden'}],
      filename: 'invalid.tsx',
    },
    {
      code: 'export default "hello";',
      errors: [{messageId: 'forbidden'}],
      filename: 'invalid.tsx',
    },
    {
      code: 'export default 42;',
      errors: [{messageId: 'forbidden'}],
      filename: 'invalid.tsx',
    },
    {
      code: 'export default () => null;',
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
