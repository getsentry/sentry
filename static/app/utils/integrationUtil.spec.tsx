import {getIntegrationSourceUrl} from 'sentry/utils/integrationUtil';

describe('getIntegrationSourceUrl()', function () {
  it('returns the correct url for Bitbucket', function () {
    const result = getIntegrationSourceUrl('bitbucket', 'https://example.com', 10);
    expect(result).toBe('https://example.com#lines-10');
  });

  it('returns the correct url for Bitbucket Server', function () {
    const result = getIntegrationSourceUrl('bitbucket_server', 'https://example.com', 10);
    expect(result).toBe('https://example.com#lines-10');
  });

  it('returns the correct url for GitHub', function () {
    const result = getIntegrationSourceUrl('github', 'https://example.com', 10);
    expect(result).toBe('https://example.com#L10');
  });

  it('returns the correct url for GitHub Enterprise', function () {
    const result = getIntegrationSourceUrl(
      'github_enterprise',
      'https://example.com',
      10
    );
    expect(result).toBe('https://example.com#L10');
  });

  it('returns the correct url for VSTS', function () {
    const result = getIntegrationSourceUrl('vsts', 'https://example.com', 10);
    expect(result).toBe(
      'https://example.com/?line=10&lineEnd=11&lineStartColumn=1&lineEndColumn=1&lineStyle=plain&_a=contents'
    );
  });
});
