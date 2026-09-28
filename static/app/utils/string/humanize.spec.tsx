import {humanize} from 'sentry/utils/string/humanize';

describe('humanize', () => {
  it('replaces underscores with spaces', () => {
    expect(humanize('reauth_required')).toBe('Reauth required');
  });

  it('capitalizes the first letter', () => {
    expect(humanize('stalled')).toBe('Stalled');
  });

  // Unlike `capitalize`, the rest of the value is left alone: an acronym the
  // API sent in caps is more readable kept that way.
  it('leaves the rest of the casing alone', () => {
    expect(humanize('needs_HTTP_retry')).toBe('Needs HTTP retry');
  });

  it('handles an empty string', () => {
    expect(humanize('')).toBe('');
  });
});
