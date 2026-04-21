import {FieldValueType} from 'sentry/utils/fields';

import {getSelectedValuesFromText, prepareInputValueForSaving} from './valueCombobox';

describe('prepareInputValueForSaving', () => {
  it('preserves manual asterisks in unquoted string values', () => {
    expect(prepareInputValueForSaving(FieldValueType.STRING, 'foo*bar')).toBe('foo*bar');
  });

  it('preserves manual asterisks in quoted string values', () => {
    expect(prepareInputValueForSaving(FieldValueType.STRING, '"foo*bar"')).toBe(
      '"foo*bar"'
    );
  });

  it('preserves manual asterisks in multi-select string values', () => {
    expect(prepareInputValueForSaving(FieldValueType.STRING, 'foo*bar,baz*qux')).toBe(
      '[foo*bar,baz*qux]'
    );
  });

  it('preserves already-escaped dropdown values', () => {
    expect(prepareInputValueForSaving(FieldValueType.STRING, 'foo\\*bar,baz\\*qux')).toBe(
      '[foo\\*bar,baz\\*qux]'
    );
  });

  it('preserves already-escaped quoted dropdown values', () => {
    expect(prepareInputValueForSaving(FieldValueType.STRING, '"foo\\*bar"')).toBe(
      '"foo\\*bar"'
    );
  });
});

describe('getSelectedValuesFromText', () => {
  it('returns both the unescaped value and the stored text for each item', () => {
    expect(getSelectedValuesFromText('\\*\\*\\*\\*,')).toEqual([
      {value: '****', text: '\\*\\*\\*\\*', selected: true},
    ]);
  });

  it('round-trips representable backslashes before literal asterisks', () => {
    expect(getSelectedValuesFromText('foo\\\\\\*bar,')).toEqual([
      {value: 'foo\\\\*bar', text: 'foo\\\\\\*bar', selected: true},
    ]);
  });

  it('preserves manual wildcards as stored text while exposing the unescaped form', () => {
    expect(getSelectedValuesFromText('foo*,bar\\*,')).toEqual([
      {value: 'foo*', text: 'foo*', selected: true},
      {value: 'bar*', text: 'bar\\*', selected: true},
    ]);
  });
});
