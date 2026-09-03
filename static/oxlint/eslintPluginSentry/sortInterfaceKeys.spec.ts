import {RuleTester} from '@typescript-eslint/rule-tester';

import {sortInterfaceKeys} from './sortInterfaceKeys';

const ruleTester = new RuleTester();
const options = [
  'asc',
  {caseSensitive: true, natural: false, requiredFirst: true},
] as const;
const descendingOptions = [
  'desc',
  {caseSensitive: true, natural: false, requiredFirst: true},
] as const;

ruleTester.run('sort-interface-keys', sortInterfaceKeys, {
  valid: [
    {code: 'interface Props { alpha: string; beta?: string }', options},
    {code: 'type Props = { alpha: string; beta?: string }', options},
    {
      code: 'interface Props { alpha: string; beta?: string; [key: string]: unknown }',
      options,
    },
    {
      code: 'interface Props { beta: string; alpha: string; [key: string]: unknown }',
      options: descendingOptions,
    },
    {
      code: 'declare const key: unique symbol; interface Props { zeta: string; [key]: string; alpha: string }',
      options,
    },
  ],
  invalid: [
    {
      code: 'interface Props { beta?: string; alpha: string }',
      options,
      errors: [{messageId: 'invalidOrder'}],
      output: 'interface Props { alpha: string; beta?: string; }',
    },
    {
      code: 'type Props = { beta: string; alpha: string }',
      options,
      errors: [{messageId: 'invalidOrder'}],
      output: 'type Props = { alpha: string; beta: string; }',
    },
    {
      code: 'interface Props { [key: string]: unknown; alpha: string; beta?: string }',
      options,
      errors: [{messageId: 'invalidOrder'}],
      output: 'interface Props { alpha: string; beta?: string; [key: string]: unknown; }',
    },
    {
      code: 'interface Props { [key: string]: unknown; alpha: string }',
      options: descendingOptions,
      errors: [{messageId: 'invalidOrder'}],
      output: 'interface Props { alpha: string; [key: string]: unknown; }',
    },
  ],
});
