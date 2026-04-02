import {RuleTester} from '@typescript-eslint/rule-tester';

import {noDigitsInTn} from './no-digits-in-tn';

const ruleTester = new RuleTester();

ruleTester.run('no-digits-in-tn', noDigitsInTn, {
  valid: [
    {code: "tn('%s project', '%s projects', 5)"},
    {code: "t('%d is fine outside tn')"},
  ],
  invalid: [
    {
      code: "tn('%d project', '%d projects', 5)",
      output: "tn('%s project', '%s projects', 5)",
      errors: [{messageId: 'noDigits'}, {messageId: 'noDigits'}],
    },
  ],
});
