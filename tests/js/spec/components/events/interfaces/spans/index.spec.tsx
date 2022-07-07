import {getOverallAlertLevelFromErrors} from 'sentry/components/events/interfaces/spans';

describe('getOverallAlertLevelFromErrors', () => {
  it('returns undefined for an empty array', () => {
    expect(getOverallAlertLevelFromErrors([])).toBeUndefined();
  });

  it('returns the alert level of the first error if only one error is provided', () => {
    expect(getOverallAlertLevelFromErrors([{level: 'error'}])).toBe('error');
  });

  it('returns the highest alert level for a set of severe errors', () => {
    expect(getOverallAlertLevelFromErrors([{level: 'fatal'}, {level: 'info'}])).toBe(
      'error'
    );
  });

  it('returns the highest alert level for a set of non-severe errors', () => {
    expect(getOverallAlertLevelFromErrors([{level: 'warning'}, {level: 'info'}])).toBe(
      'warning'
    );
  });

  it('returns the highest alert level for a set of info errors', () => {
    expect(getOverallAlertLevelFromErrors([{level: 'info'}, {level: 'info'}])).toBe(
      'info'
    );
  });
});
