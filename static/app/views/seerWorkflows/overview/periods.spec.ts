import {periodWindowLabel} from 'sentry/views/seerWorkflows/overview/periods';

describe('periodWindowLabel', () => {
  it('labels a known period', () => {
    expect(periodWindowLabel('14d')).toBe('in the last 14 days');
  });

  it('returns no label for an absolute range or unknown period', () => {
    expect(periodWindowLabel(null)).toBe('');
    expect(periodWindowLabel('3d')).toBe('');
  });
});
