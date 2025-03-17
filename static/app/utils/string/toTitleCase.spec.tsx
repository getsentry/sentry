import {toTitleCase} from 'sentry/utils/string/toTitleCase';

describe('toTitleCase', () => {
  it('capitalizes the first letter of each word', () => {
    expect(toTitleCase('sentry: fix your code')).toBe('Sentry: Fix Your Code');
  });

  it('treats non-word characters as the parts of the same word', () => {
    expect(toTitleCase('sentry-code-breaks')).toBe('Sentry-code-breaks');
  });

  it('flattens words with capitals in the middle', () => {
    expect(toTitleCase('seNTRy: fIX youR Code')).toBe('Sentry: Fix Your Code');
  });

  it("doesn't flatten inner capitals if specified", () => {
    expect(toTitleCase('seNTRy: fIX youR Code', {allowInnerUpperCase: true})).toBe(
      'SeNTRy: FIX YouR Code'
    );
  });
});
