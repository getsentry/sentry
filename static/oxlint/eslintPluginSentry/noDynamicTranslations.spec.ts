import {RuleTester} from 'oxlint/plugins-dev';

import {noDynamicTranslations} from './noDynamicTranslations';

const ruleTester = new RuleTester();

ruleTester.run('no-dynamic-translations', noDynamicTranslations, {
  valid: [
    {code: "t('static string')"},
    {code: 't(`template without interpolation`)'},
    {code: "tn('%s item', '%s items', count)"},
    {code: "tct('Hello [name]', {name})"},
    {code: 't()'},
    {code: "tn('%s item')"},
    {code: 'translate(dynamicVariable)'},
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
    {
      code: "tn(singular, '%s items', count)",
      errors: [{messageId: 'dynamic', data: {fnName: 'tn'}}],
    },
    {
      code: "tn('%s item', plural, count)",
      errors: [{messageId: 'dynamic', data: {fnName: 'tn'}}],
    },
    {
      code: 'tct(message, {name})',
      errors: [{messageId: 'dynamic', data: {fnName: 'tct'}}],
    },
  ],
});
