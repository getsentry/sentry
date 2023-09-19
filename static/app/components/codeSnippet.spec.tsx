import {replaceTokensWithSpan} from 'sentry/components/codeSnippet';

describe('replaceTokenWithSpan', function () {
  it('replaces token', function () {
    const element = document.createElement('div');
    element.innerHTML =
      '<span class="token assign-left variable">SENTRY_AUTH_TOKEN</span><span class="token operator">=</span>___ORG_AUTH_TOKEN___';
    const tokenNodes = replaceTokensWithSpan(element, ['___ORG_AUTH_TOKEN___']);

    expect(element.innerHTML).toEqual(
      '<span class="token assign-left variable">SENTRY_AUTH_TOKEN</span><span class="token operator">=</span><span data-token="___ORG_AUTH_TOKEN___"></span>'
    );
    expect(tokenNodes.___ORG_AUTH_TOKEN___).toHaveLength(1);
    expect(element.contains(tokenNodes.___ORG_AUTH_TOKEN___[0])).toBe(true);
  });

  it('replaces multiple tokens', function () {
    const element = document.createElement('div');
    element.innerHTML = `
const cdn = '___CDN___';
const assetUrl = '___CDN___/assets';
const secret = '___SECRET___';
`;
    const tokenNodes = replaceTokensWithSpan(element, ['___CDN___', '___SECRET___']);

    expect(element.innerHTML).toEqual(
      `
const cdn = '<span data-token="___CDN___"></span>';
const assetUrl = '<span data-token="___CDN___"></span>/assets';
const secret = '<span data-token="___SECRET___"></span>';
`
    );
    expect(tokenNodes.___CDN___).toHaveLength(2);
    expect(element.contains(tokenNodes.___CDN___[0])).toBe(true);
    expect(element.contains(tokenNodes.___CDN___[1])).toBe(true);

    expect(tokenNodes.___SECRET___).toHaveLength(1);
    expect(element.contains(tokenNodes.___SECRET___[0])).toBe(true);
  });
});
