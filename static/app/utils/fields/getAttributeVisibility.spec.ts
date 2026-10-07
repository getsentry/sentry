import {getAttributeVisibility} from 'sentry/utils/fields/getAttributeVisibility';

describe('getAttributeVisibility', () => {
  it.each([
    'logger.name',
    'sentry.logger.name',
    'tags[code.line.number,number]',
    'ai.completion_tokens.used',
    'checkout.cart_size',
    'constructor',
    'toString',
    '__proto__',
  ])('treats %s as public', key => {
    expect(getAttributeVisibility(key)).toBe('public');
  });

  it.each([
    'sentry.dsc.environment',
    'dsc.environment',
    'tags[sentry.dsc.sampled,boolean]',
    'tags[dsc.sampled,boolean]',
    'sentry._internal.custom_attribute',
    '_internal.custom_attribute',
    '__sentry_internal.custom_attribute',
    'SENTRY._INTERNAL.custom_attribute',
  ])('treats %s as internal', key => {
    expect(getAttributeVisibility(key)).toBe('internal');
  });

  it.each([
    ['sentry.dsc.environment', 'environment'],
    ['environment', 'sentry.dsc.environment'],
  ])('gives internal visibility precedence for %s and %s', (key, name) => {
    expect(getAttributeVisibility(key, name)).toBe('internal');
  });
});
