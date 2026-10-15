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
  ],
});
