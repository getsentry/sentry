import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {ManualInstrumentationNote} from './llmOnboardingInstructions';

describe('ManualInstrumentationNote', () => {
  const docsLink = <a href="https://docs.sentry.io">docs</a>;

  it('renders "Copy instructions" text when feature is enabled', () => {
    const organization = OrganizationFixture({
      features: ['onboarding-copy-setup-instructions'],
    });

    render(<ManualInstrumentationNote docsLink={docsLink} />, {organization});

    expect(screen.getByText(/Copy instructions/)).toBeInTheDocument();
    expect(
      screen.queryByRole('button', {name: 'Copy Prompt for AI Agent'})
    ).not.toBeInTheDocument();
  });

  it('renders CopyLLMPromptButton when feature is disabled', () => {
    const organization = OrganizationFixture();

    render(<ManualInstrumentationNote docsLink={docsLink} />, {organization});

    expect(
      screen.getByRole('button', {name: 'Copy Prompt for AI Agent'})
    ).toBeInTheDocument();
    expect(screen.queryByText(/Copy instructions/)).not.toBeInTheDocument();
  });
});
