import {render, screen} from 'sentry-test/reactTestingLibrary';

import {
  OnboardingCodeSnippet,
  replaceTokensWithSpan,
} from 'sentry/components/onboarding/gettingStartedDoc/onboardingCodeSnippet';

describe('OnboardingCodeSnippet', () => {
  it('beautifies JavaScript snippets', async () => {
    render(
      <OnboardingCodeSnippet language="javascript">
        {'const options={enabled:true};'}
      </OnboardingCodeSnippet>
    );

    expect(
      await screen.findByText('const options = { enabled: true };')
    ).toBeInTheDocument();
  });
});

describe('replaceTokenWithSpan', () => {
  it('replaces __ORG_AUTH_TOKEN___ token', () => {
    const element = document.createElement('div');
    element.innerHTML =
      '<span class="token assign-left variable">SENTRY_AUTH_TOKEN</span><span class="token operator">=</span>___ORG_AUTH_TOKEN___';
    const tokenNodes = replaceTokensWithSpan(element);

    expect(element.innerHTML).toBe(
      '<span class="token assign-left variable">SENTRY_AUTH_TOKEN</span><span class="token operator">=</span><span data-token="___ORG_AUTH_TOKEN___"></span>'
    );
    expect(tokenNodes).toHaveLength(1);
    expect(element.contains(tokenNodes[0]!)).toBe(true);
  });

  it('replaces multiple ___ORG_AUTH_TOKEN___ tokens', () => {
    const element = document.createElement('div');
    element.innerHTML = `
const cdn = '___ORG_AUTH_TOKEN___';
const assetUrl = '___ORG_AUTH_TOKEN___';
`;
    const tokenNodes = replaceTokensWithSpan(element);

    expect(element.innerHTML).toBe(
      `
const cdn = '<span data-token="___ORG_AUTH_TOKEN___"></span>';
const assetUrl = '<span data-token="___ORG_AUTH_TOKEN___"></span>';
`
    );
    expect(tokenNodes).toHaveLength(2);
    expect(element.contains(tokenNodes[0]!)).toBe(true);
    expect(element.contains(tokenNodes[1]!)).toBe(true);
  });
});
