import {
  getSeverityColorVariant,
  isSeverityFilterKey,
} from 'sentry/components/searchQueryBuilder/tokens/filter/valueSuggestions/severity/utils';

describe('isSeverityFilterKey', () => {
  it.each([
    {key: 'severity', expected: true},
    {key: 'level', expected: true},
    {key: 'message', expected: false},
    {key: 'severity_number', expected: false},
  ])('returns $expected when the key is "$key"', ({key, expected}) => {
    expect(isSeverityFilterKey(key)).toBe(expected);
  });
});

describe('getSeverityColorVariant', () => {
  it.each([
    {value: 'error', variant: 'danger'},
    {value: 'fatal', variant: 'danger'},
    {value: 'warn', variant: 'warning'},
    {value: 'warning', variant: 'warning'},
    {value: 'info', variant: 'accent'},
    {value: 'trace', variant: 'accent'},
    {value: 'sample', variant: 'accent'},
    {value: 'debug', variant: 'muted'},
    {value: 'default', variant: 'muted'},
    {value: 'something-else', variant: 'muted'},
    {value: 'ERROR', variant: 'danger'},
    {value: 'Warn', variant: 'warning'},
  ])('returns "$variant" when the value is "$value"', ({value, variant}) => {
    expect(getSeverityColorVariant(value)).toBe(variant);
  });
});
