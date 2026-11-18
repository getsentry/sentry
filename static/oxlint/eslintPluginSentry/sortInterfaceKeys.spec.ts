import {RuleTester} from 'oxlint/plugins-dev';

import {sortInterfaceKeys} from './sortInterfaceKeys';

const ruleTester = new RuleTester({languageOptions: {parserOptions: {lang: 'ts'}}});
const options = ['asc', {caseSensitive: true, natural: false, requiredFirst: true}];

ruleTester.run('sort-interface-keys', sortInterfaceKeys, {
  valid: [
    {code: 'interface Props { alpha: string; beta?: string }', options},
    {code: 'type Props = { alpha: string; beta?: string }', options},
    {
      code: 'declare const key: unique symbol; interface Props { zeta: string; [key]: string; alpha: string }',
      options,
    },
    {code: 'interface Props { B: string; a: string }', options},
    {code: 'interface Props { a10: string; a2: string }', options},
    {code: "interface Props { 'a': string; 'b': string }", options},
    {code: 'interface Props { a(): void; a(value: string): void }', options},
    {code: 'interface Props { [key: string]: string; a: string }', options},
    {code: 'interface Props { [key: string]: string; A: string }', options},
    {code: 'interface Props { (): void; a: string; new (): Props }', options},
    {code: 'interface Props { a?: string; b: string }', options: ['asc']},
    {code: 'interface Props { a?: string; b: string }'},
    {code: 'interface Props { b: string; a: string }', options: ['desc']},
    {
      code: 'interface Props { a: string; B: string }',
      options: ['asc', {caseSensitive: false}],
    },
    {
      code: 'interface Props { a2: string; a10: string }',
      options: ['asc', {natural: true}],
    },
  ],
  invalid: [
    {
      code: 'interface Props { beta?: string; alpha: string }',
      options,
      errors: [
        {
          messageId: 'invalidOrder',
          data: {
            description: 'required-first ascending',
            previousName: 'beta',
            thisName: 'alpha',
          },
        },
      ],
      output: 'interface Props { alpha: string; beta?: string; }',
    },
    {
      code: 'type Props = { beta: string; alpha: string }',
      options,
      errors: [{messageId: 'invalidOrder'}],
      output: 'type Props = { alpha: string; beta: string; }',
    },
    {
      code: 'interface Props { a?: string; b: string }',
      options,
      errors: [{messageId: 'invalidOrder'}],
      output: 'interface Props { b: string; a?: string; }',
    },
    {
      code: 'interface Props { a?(): void; b(): void }',
      options,
      errors: [{messageId: 'invalidOrder'}],
      output: 'interface Props { b(): void; a?(): void; }',
    },
    {
      code: 'interface Props { b(): void; a(): void }',
      options,
      errors: [{messageId: 'invalidOrder'}],
      output: 'interface Props { a(): void; b(): void; }',
    },
    {
      code: "interface Props { 'b': string; 'a': string }",
      options,
      errors: [
        {
          messageId: 'invalidOrder',
          data: {
            description: 'required-first ascending',
            previousName: 'b',
            thisName: 'a',
          },
        },
      ],
      output: "interface Props { 'a': string; 'b': string; }",
    },
    {
      code: 'interface Props { a: string; [key: string]: string }',
      options,
      errors: [
        {
          messageId: 'invalidOrder',
          data: {
            description: 'required-first ascending',
            previousName: 'a',
            thisName: '[index: key]',
          },
        },
      ],
      output: 'interface Props { [key: string]: string; a: string; }',
    },
    {
      code: 'interface Props { A: string; [key: string]: string }',
      options,
      errors: [{messageId: 'invalidOrder'}],
      output: 'interface Props { [key: string]: string; A: string; }',
    },
    {
      code: 'interface Props { a: string; B: string }',
      options,
      errors: [{messageId: 'invalidOrder'}],
      output: 'interface Props { B: string; a: string; }',
    },
    {
      code: 'interface Props { a: string; b: string }',
      options: ['desc'],
      errors: [
        {
          messageId: 'invalidOrder',
          data: {description: 'descending', previousName: 'a', thisName: 'b'},
        },
      ],
      output: 'interface Props { b: string; a: string; }',
    },
    {
      code: 'interface Props { B: string; a: string }',
      options: ['asc', {caseSensitive: false}],
      errors: [
        {
          messageId: 'invalidOrder',
          data: {
            description: 'case-insensitive ascending',
            previousName: 'B',
            thisName: 'a',
          },
        },
      ],
      output: 'interface Props { a: string; B: string; }',
    },
    {
      code: 'interface Props { a10: string; a2: string }',
      options: ['asc', {natural: true}],
      errors: [
        {
          messageId: 'invalidOrder',
          data: {description: 'natural ascending', previousName: 'a10', thisName: 'a2'},
        },
      ],
      output: 'interface Props { a2: string; a10: string; }',
    },
    {
      code: 'interface Props { c: string; b: string; a: string }',
      options,
      errors: [{messageId: 'invalidOrder'}, {messageId: 'invalidOrder'}],
      output: 'interface Props { a: string; b: string; c: string; }',
    },
    {
      code: `
interface Props {
  b: string
  a: string
}`,
      options,
      errors: [{messageId: 'invalidOrder'}],
      output: `
interface Props {
  a: string;
  b: string
}`,
    },
    {
      code: 'interface Props { b: string; /* comment */ a: string }',
      options,
      errors: [{messageId: 'invalidOrder'}],
      output: null,
    },
    {
      code: `
interface Props {
  b: string;

  a: string;
  c: string;
}`,
      options,
      errors: [{messageId: 'invalidOrder'}],
      output: null,
    },
  ],
});
