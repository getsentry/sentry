import {getCumulativeAlertLevelFromErrors} from 'sentry/components/events/interfaces/spans/utils';

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
