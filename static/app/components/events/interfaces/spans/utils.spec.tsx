import {RawSpanType} from 'sentry/components/events/interfaces/spans/types';
import {
  formatSpanTreeLabel,
  getCumulativeAlertLevelFromErrors,
  getFormattedTimeRangeWithLeadingAndTrailingZero,
} from 'sentry/components/events/interfaces/spans/utils';

describe('test utility functions', function () {
  it('getFormattedTimeRangeWithLeadingAndTrailingZero', function () {
    let result = getFormattedTimeRangeWithLeadingAndTrailingZero(
      1658925888.601534,
      1658925888.60193
    );

    expect(result.start).toEqual('1658925888.601534');
    expect(result.end).toEqual('1658925888.601930');

    result = getFormattedTimeRangeWithLeadingAndTrailingZero(
      1658925888.601534,
      165892588.060193
    );
    expect(result.start).toEqual('1658925888.601534');
    expect(result.end).toEqual('0165892588.060193');

    result = getFormattedTimeRangeWithLeadingAndTrailingZero(
      16589258.6015,
      1658925888.060193
    );
    expect(result.start).toEqual('0016589258.601500');
    expect(result.end).toEqual('1658925888.060193');

    result = getFormattedTimeRangeWithLeadingAndTrailingZero(
      1658925888.601534,
      1658925888.601935
    );
    expect(result.start).toEqual('1658925888.601534');
    expect(result.end).toEqual('1658925888.601935');
  });
});

describe('formatSpanTreeLabel', () => {
  it('returns the span id if description is missing', () => {
    expect(
      formatSpanTreeLabel({
        span_id: 'ba4e7d11',
      } as RawSpanType)
    ).toBe('ba4e7d11');
  });

  it('returns the description for database spans', () => {
    expect(
      formatSpanTreeLabel({
        op: 'db',
        description: 'SELECT * FROM books',
      } as RawSpanType)
    ).toBe('SELECT * FROM books');
  });

  it('decodes the URL for http spans', () => {
    expect(
      formatSpanTreeLabel({
        op: 'http.client',
        description: 'GET /items?query=hello%20world',
      } as RawSpanType)
    ).toBe('GET /items?query=hello world');
  });

  it('returns the description for gap spans', () => {
    expect(
      formatSpanTreeLabel({
        isOrphan: false,
        start_timestamp: 0,
        timestamp: 0,
        type: 'gap',
        description: 'Missing instrumentation',
      })
    ).toBe('Missing instrumentation');
  });
});

describe('getCumulativeAlertLevelFromErrors', () => {
  it('returns undefined for an empty array', () => {
    expect(getCumulativeAlertLevelFromErrors([])).toBeUndefined();
  });

  it('returns the alert level of the first error if only one error is provided', () => {
    expect(getCumulativeAlertLevelFromErrors([{level: 'error'}])).toBe('error');
  });

  it('returns the highest alert level for a set of severe errors', () => {
    expect(getCumulativeAlertLevelFromErrors([{level: 'fatal'}, {level: 'info'}])).toBe(
      'error'
    );
  });

  it('returns the highest alert level for a set of non-severe errors', () => {
    expect(getCumulativeAlertLevelFromErrors([{level: 'warning'}, {level: 'info'}])).toBe(
      'warning'
    );
  });

  it('returns the highest alert level for a set of info errors', () => {
    expect(getCumulativeAlertLevelFromErrors([{level: 'info'}, {level: 'info'}])).toBe(
      'info'
    );
  });
});
