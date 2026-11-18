import {RuleTester} from 'oxlint/plugins-dev';

import {noStaticTranslations} from './noStaticTranslations';

const ruleTester = new RuleTester({
  languageOptions: {
    parserOptions: {
      lang: 'ts',
    },
  },
});

ruleTester.run('no-static-translations', noStaticTranslations, {
  valid: [
    {code: 'td(ATTRIBUTE_SEARCH_METADATA[key].brief)'},
    {code: 'td(ATTRIBUTE_SEARCH_METADATA[key]!.brief)'},
    {code: 'td(ATTRIBUTE_SEARCH_METADATA.key.brief)'},
    {code: 'td()'},
    {code: "t('static string')"},
    {code: "locale.td('static string')"},
  ],
  invalid: [
    {
      code: "td('static string')",
      errors: [{messageId: 'forbidden', line: 1, column: 3, endLine: 1, endColumn: 18}],
    },
    {
      code: 'td(description)',
      errors: [{messageId: 'forbidden'}],
    },
    {
      code: 'td(metadata.brief)',
      errors: [{messageId: 'forbidden'}],
    },
    {
      code: 'td(ATTRIBUTE_SEARCH_METADATA.brief)',
      errors: [{messageId: 'forbidden'}],
    },
    {
      code: 'td(OTHER_METADATA[key].brief)',
      errors: [{messageId: 'forbidden'}],
    },
    {
      code: 'td(ATTRIBUTE_SEARCH_METADATA[key].description)',
      errors: [{messageId: 'forbidden'}],
    },
    {
      code: 'td(ATTRIBUTE_SEARCH_METADATA[key][brief])',
      errors: [{messageId: 'forbidden'}],
    },
  ],
});
