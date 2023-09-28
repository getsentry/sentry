import {replaceTokensWithSpan} from 'sentry/components/onboarding/gettingStartedDoc/onboardingCodeSnippet';

describe('replaceTokenWithSpan', function () {
  it('replaces __ORG_AUTH_TOKEN___ token', function () {
    const element = document.createElement('div');
    element.innerHTML =
      '<span class="token assign-left variable">SENTRY_AUTH_TOKEN</span><span class="token operator">=</span>___ORG_AUTH_TOKEN___';
    const tokenNodes = replaceTokensWithSpan(element);

    expect(element.innerHTML).toEqual(
      '<span class="token assign-left variable">SENTRY_AUTH_TOKEN</span><span class="token operator">=</span><span data-token="___ORG_AUTH_TOKEN___"></span>'
    );
    expect(tokenNodes).toHaveLength(1);
    expect(element.contains(tokenNodes[0])).toBe(true);
  });

  it('replaces multiple ___ORG_AUTH_TOKEN___ tokens', function () {
    const element = document.createElement('div');
    element.innerHTML = `
const cdn = '___ORG_AUTH_TOKEN___';
const assetUrl = '___ORG_AUTH_TOKEN___';
`;
    const tokenNodes = replaceTokensWithSpan(element);

    expect(element.innerHTML).toEqual(
      `
const cdn = '<span data-token="___ORG_AUTH_TOKEN___"></span>';
const assetUrl = '<span data-token="___ORG_AUTH_TOKEN___"></span>';
`
    );
    expect(tokenNodes).toHaveLength(2);
    expect(element.contains(tokenNodes[0])).toBe(true);
    expect(element.contains(tokenNodes[1])).toBe(true);
  });
});
