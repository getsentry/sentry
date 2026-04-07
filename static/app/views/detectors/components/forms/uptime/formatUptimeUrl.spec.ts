import {formatUptimeUrl} from 'sentry/views/detectors/components/forms/uptime/formatUptimeUrl';

describe('formatUptimeUrl', () => {
  it('returns the host when the URL has no path', () => {
    expect(formatUptimeUrl('https://example.com')).toBe('example.com');
  });

  it('includes the path and strips a trailing slash', () => {
    expect(formatUptimeUrl('https://example.com/health/check/')).toBe(
      'example.com/health/check'
    );
  });

  it('returns null for invalid URLs', () => {
    expect(formatUptimeUrl('not-a-url')).toBeNull();
  });
});
