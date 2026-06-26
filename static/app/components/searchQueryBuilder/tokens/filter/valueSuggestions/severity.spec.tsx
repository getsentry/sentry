import {render, screen} from 'sentry-test/reactTestingLibrary';

import {
  getSeverityColorVariant,
  isSeverityFilterKey,
  SeverityValueIndicator,
} from 'sentry/components/searchQueryBuilder/tokens/filter/valueSuggestions/severity';

describe('isSeverityFilterKey', () => {
  it('returns true when the key is a severity level field', () => {
    expect(isSeverityFilterKey('severity')).toBe(true);
    expect(isSeverityFilterKey('level')).toBe(true);
  });

  it('returns false when the key is not a severity level field', () => {
    expect(isSeverityFilterKey('message')).toBe(false);
    expect(isSeverityFilterKey('severity_number')).toBe(false);
  });
});

describe('getSeverityColorVariant', () => {
  it('returns danger when the value is error or fatal', () => {
    expect(getSeverityColorVariant('error')).toBe('danger');
    expect(getSeverityColorVariant('fatal')).toBe('danger');
  });

  it('returns warning when the value is warn or warning', () => {
    expect(getSeverityColorVariant('warn')).toBe('warning');
    expect(getSeverityColorVariant('warning')).toBe('warning');
  });

  it('returns accent when the value is info, trace, or sample', () => {
    expect(getSeverityColorVariant('info')).toBe('accent');
    expect(getSeverityColorVariant('trace')).toBe('accent');
    expect(getSeverityColorVariant('sample')).toBe('accent');
  });

  it('returns neutral when the value is debug, default, or unrecognized', () => {
    expect(getSeverityColorVariant('debug')).toBe('neutral');
    expect(getSeverityColorVariant('default')).toBe('neutral');
    expect(getSeverityColorVariant('something-else')).toBe('neutral');
  });

  it('matches values case-insensitively', () => {
    expect(getSeverityColorVariant('ERROR')).toBe('danger');
    expect(getSeverityColorVariant('Warn')).toBe('warning');
  });
});

describe('SeverityValueIndicator', () => {
  it('renders an indicator for the given value', () => {
    render(<SeverityValueIndicator value="error" />);

    expect(screen.getByTestId('severity-indicator')).toBeInTheDocument();
  });
});
