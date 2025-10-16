import {getIntegrationSourceUrl} from 'sentry/utils/integrationUtil';

describe('getIntegrationSourceUrl()', () => {
  it('returns the correct url for Bitbucket', () => {
    const result = getIntegrationSourceUrl('bitbucket', 'https://example.com', 10);
    expect(result).toBe('https://example.com#lines-10');
  });

  it('returns the correct url for Bitbucket Server', () => {
    const result = getIntegrationSourceUrl('bitbucket_server', 'https://example.com', 10);
    expect(result).toBe('https://example.com#lines-10');
  });

  it('returns the correct url for GitHub', () => {
    const result = getIntegrationSourceUrl('github', 'https://example.com', 10);
    expect(result).toBe('https://example.com#L10');
  });

  it('returns the correct url for GitHub Enterprise', () => {
    const result = getIntegrationSourceUrl(
      'github_enterprise',
      'https://example.com',
      10
    );
    expect(result).toBe('https://example.com#L10');
  });

  it('returns the correct url for VSTS', () => {
    const result = getIntegrationSourceUrl('vsts', 'https://example.com', 10);
    expect(result).toBe(
      'https://example.com/?line=10&lineEnd=11&lineStartColumn=1&lineEndColumn=1&lineStyle=plain&_a=contents'
    );
  });
});
