import {render, screen} from 'sentry-test/reactTestingLibrary';

import {
  formatStoreCrashReports,
  getStoreCrashReportsValues,
} from 'sentry/utils/crashReports';

describe('crashReportsUtils', () => {
  it('returns correct values for organization scope', () => {
    expect(getStoreCrashReportsValues(0)).toEqual([0, 1, 5, 10, 20, 50, 100, -1]);
  });
  it('returns correct values for project scope', () => {
    expect(getStoreCrashReportsValues(1)).toEqual([null, 0, 1, 5, 10, 20, 50, 100, -1]);
  });
  it('formats basic values', () => {
    expect(formatStoreCrashReports(-1)).toBe('Unlimited');
    expect(formatStoreCrashReports(0)).toBe('Disabled');
  });
  it('formats per issue values', () => {
    render(<div data-test-id="subject">{formatStoreCrashReports(10)}</div>);
    expect(screen.getByTestId('subject')).toHaveTextContent('10 per issue');
  });
  it('formats with org inheritance', () => {
    render(<div data-test-id="subject">{formatStoreCrashReports(null, 5)}</div>);
    expect(screen.getByTestId('subject')).toHaveTextContent(
      'Inherit organization settings (5 per issue)'
    );
  });
  it('formats with org inheritance disabled', () => {
    render(<div data-test-id="subject">{formatStoreCrashReports(null, 0)}</div>);
    expect(screen.getByTestId('subject')).toHaveTextContent(
      'Inherit organization settings (Disabled)'
    );
  });
});
