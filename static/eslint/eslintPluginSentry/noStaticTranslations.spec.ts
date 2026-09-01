import {RuleTester} from '@typescript-eslint/rule-tester';

import {noStaticTranslations} from './noStaticTranslations';

const ruleTester = new RuleTester();

ruleTester.run('no-static-translations', noStaticTranslations, {
  valid: [{code: 'td(ATTRIBUTE_SEARCH_METADATA[key]!.brief)'}],
  invalid: [
    {
      code: 'td(ATTRIBUTE_METADATA[key].brief)',
      errors: [{messageId: 'forbidden'}],
    },
    {
      code: 'td(metadata[key].brief)',
      errors: [{messageId: 'forbidden'}],
    },
    {
      code: 'td(dynamicValue)',
      errors: [{messageId: 'forbidden'}],
    },
  ],
});
