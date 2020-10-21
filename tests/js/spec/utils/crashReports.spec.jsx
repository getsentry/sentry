import {shallow} from 'sentry-test/enzyme';

import {
  formatStoreCrashReports,
  getStoreCrashReportsValues,
} from 'app/utils/crashReports';

describe('crashReportsUtils', () => {
  it('returns correct values for organization scope', () => {
    expect(getStoreCrashReportsValues(0)).toEqual([0, 1, 5, 10, 20, -1]);
  });
  it('returns correct values for project scope', () => {
    expect(getStoreCrashReportsValues(1)).toEqual([null, 0, 1, 5, 10, 20, -1]);
  });
  it('formats the value', () => {
    expect(formatStoreCrashReports(-1)).toBe('Unlimited');
    expect(formatStoreCrashReports(0)).toBe('Disabled');
    expect(shallow(<div>{formatStoreCrashReports(10)}</div>).text()).toBe('10 per issue');
    expect(shallow(<div>{formatStoreCrashReports(null, 5)}</div>).text()).toBe(
      'Inherit organization settings (5 per issue)'
    );
    expect(shallow(<div>{formatStoreCrashReports(null, 0)}</div>).text()).toBe(
      'Inherit organization settings (Disabled)'
    );
  });
});
