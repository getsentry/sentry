import {RuleTester} from '@typescript-eslint/rule-tester';

import {restrictTypesFile} from './restrict-types-file';

const ruleTester = new RuleTester();

const TYPES_FILE = '/static/app/utils/replays/types.tsx';

ruleTester.run('restrict-types-file', restrictTypesFile, {
  valid: [
    {
      code: 'export type Foo = {bar: string};',
      filename: TYPES_FILE,
    },
    {
      code: 'export interface Foo {bar: string}',
      filename: TYPES_FILE,
    },
    {
      code: 'export enum Color {Red, Blue}',
      filename: TYPES_FILE,
    },
    {
      code: 'declare const x: number;',
      filename: TYPES_FILE,
    },
    {
      code: "import type {Foo} from 'react';\nexport type Bar = Foo;",
      filename: TYPES_FILE,
    },
    {
      code: "import type {Foo} from 'sentry/types/group';\nexport type Bar = Foo;",
      filename: TYPES_FILE,
    },
    {
      code: "import type {Foo} from './typesBase';\nexport type Bar = Foo;",
      filename: TYPES_FILE,
    },
    {
      code: "import type {Foo} from 'sentry/utils/replays/types';\nexport type Bar = Foo;",
      filename: TYPES_FILE,
    },
    {
      code: "export type {Foo} from './typesBase';",
      filename: TYPES_FILE,
    },
    {
      // Non-types files are unaffected.
      code: "import {makeFoo} from 'sentry/views/widget';\nexport const foo = makeFoo();",
      filename: '/static/app/utils/replays/index.tsx',
    },
  ],
  invalid: [
    {
      code: 'export const config = {timeout: 30};',
      filename: TYPES_FILE,
      errors: [{messageId: 'runtimeDeclaration'}],
    },
    {
      code: 'export function makeFoo() { return {}; }',
      filename: TYPES_FILE,
      errors: [{messageId: 'runtimeDeclaration'}],
    },
    {
      code: 'export class Foo {}',
      filename: TYPES_FILE,
      errors: [{messageId: 'runtimeDeclaration'}],
    },
    {
      code: 'const internal = 1;',
      filename: TYPES_FILE,
      errors: [{messageId: 'runtimeDeclaration'}],
    },
    {
      code: 'export default {a: 1};',
      filename: TYPES_FILE,
      errors: [{messageId: 'runtimeDeclaration'}],
    },
    {
      code: "import {makeFoo} from 'sentry/views/widget';\nexport type Foo = ReturnType<typeof makeFoo>;",
      filename: TYPES_FILE,
      errors: [{messageId: 'disallowedImport'}],
    },
    {
      code: "import type {Foo} from './someComponent';\nexport type Bar = Foo;",
      filename: TYPES_FILE,
      errors: [{messageId: 'disallowedImport'}],
    },
    {
      code: "export type {Foo} from 'sentry/views/widget';",
      filename: TYPES_FILE,
      errors: [{messageId: 'disallowedImport'}],
    },
    {
      code: "export * from 'sentry/views/widget';",
      filename: TYPES_FILE,
      errors: [{messageId: 'disallowedImport'}],
    },
  ],
});
