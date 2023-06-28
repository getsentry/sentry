import {getIntegrationSourceUrl} from 'sentry/utils/integrationUtil';

describe('getIntegrationSourceUrl()', function () {
  it('returns the correct url for VSTS', function () {
    const result = getIntegrationSourceUrl('vsts', 'http://example.com', 10);
    expect(result).toEqual(
      'http://example.com/?line=10&lineEnd=11&lineStartColumn=1&lineEndColumn=1&lineStyle=plain&_a=contents'
    );
  });

  it('returns the correct url for GitHub', function () {
    const result = getIntegrationSourceUrl('github', 'http://example.com', 10);
    expect(result).toEqual('http://example.com#L10');
  });
});
