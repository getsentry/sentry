import {RuleTester} from '@typescript-eslint/rule-tester';

import {noDynamicTranslations} from './no-dynamic-translations';

const ruleTester = new RuleTester();

ruleTester.run('no-dynamic-translations', noDynamicTranslations, {
  valid: [
    {code: "t('static string')"},
    {code: 't(`template without interpolation`)'},
    {code: "tn('%s item', '%s items', count)"},
    {code: "tct('Hello [name]', {name})"},
  ],
  invalid: [
    {
      code: 't(`Hello ${name}`)',
      errors: [{messageId: 'interpolation'}],
    },
    {
      code: 't(dynamicVariable)',
      errors: [{messageId: 'dynamic'}],
    },
  ],
});
