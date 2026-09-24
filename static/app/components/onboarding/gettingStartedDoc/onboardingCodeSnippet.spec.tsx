import {render, screen} from 'sentry-test/reactTestingLibrary';

import {OnboardingCodeSnippet} from 'sentry/components/onboarding/gettingStartedDoc/onboardingCodeSnippet';

describe('OnboardingCodeSnippet', () => {
  it('renders the auth token generator inline in place of the placeholder', () => {
    render(
      <OnboardingCodeSnippet language="bash">
        {'sentry-cli login --auth-token ___ORG_AUTH_TOKEN___'}
      </OnboardingCodeSnippet>
    );

    // The raw placeholder is never shown to the user...
    expect(
      screen.queryByText('___ORG_AUTH_TOKEN___', {exact: false})
    ).not.toBeInTheDocument();
    // ...the generator is rendered in its place instead.
    expect(screen.getByText('Click to generate token')).toBeInTheDocument();
  });

  it('handles snippets without a placeholder', () => {
    render(
      <OnboardingCodeSnippet language="bash">
        {'echo "hello world"'}
      </OnboardingCodeSnippet>
    );

    expect(screen.queryByText('Click to generate token')).not.toBeInTheDocument();
  });
});
