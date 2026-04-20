import {FieldValueType} from 'sentry/utils/fields';

import {getSelectedValuesFromText, prepareInputValueForSaving} from './valueCombobox';

describe('prepareInputValueForSaving', () => {
  it('escapes asterisks in unquoted string values', () => {
    expect(prepareInputValueForSaving(FieldValueType.STRING, 'foo*bar')).toBe(
      'foo\\*bar'
    );
  });

  it('escapes asterisks in quoted string values', () => {
    expect(prepareInputValueForSaving(FieldValueType.STRING, '"foo*bar"')).toBe(
      '"foo\\*bar"'
    );
  });

  it('escapes asterisks in multi-select string values', () => {
    expect(prepareInputValueForSaving(FieldValueType.STRING, 'foo*bar,baz*qux')).toBe(
      '[foo\\*bar,baz\\*qux]'
    );
  });
});

describe('getSelectedValuesFromText', () => {
  it('returns unescaped values for internal matching without changing the saved text', () => {
    expect(getSelectedValuesFromText('\\*\\*\\*\\*,', {escaped: false})).toEqual([
      {value: '****', selected: true},
    ]);
  });

  it('round-trips representable backslashes before literal asterisks', () => {
    expect(getSelectedValuesFromText('foo\\\\\\*bar,', {escaped: false})).toEqual([
      {value: 'foo\\\\*bar', selected: true},
    ]);
  });
});
