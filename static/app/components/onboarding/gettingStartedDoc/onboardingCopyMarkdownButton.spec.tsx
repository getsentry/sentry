import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import type {OnboardingStep} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';

import {OnboardingCopyMarkdownButton} from './onboardingCopyMarkdownButton';

describe('OnboardingCopyMarkdownButton', () => {
  const steps: OnboardingStep[] = [
    {
      type: StepType.INSTALL,
      content: [{type: 'text', text: 'Install the SDK'}],
    },
  ];

  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: {writeText: jest.fn().mockResolvedValue('')},
    });
  });

  it('copies steps markdown without postamble', async () => {
    const organization = OrganizationFixture();

    render(<OnboardingCopyMarkdownButton steps={steps} source="test_source" />, {
      organization,
    });

    await userEvent.click(screen.getByRole('button', {name: 'Copy instructions'}));

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.not.stringContaining('---')
    );
  });

  it('appends postamble separated by hr when provided', async () => {
    const organization = OrganizationFixture();
    const postamble = '# Extra instructions';

    render(
      <OnboardingCopyMarkdownButton
        steps={steps}
        source="test_source"
        postamble={postamble}
      />,
      {organization}
    );

    await userEvent.click(screen.getByRole('button', {name: 'Copy instructions'}));

    const copiedText = (navigator.clipboard.writeText as jest.Mock).mock.calls[0][0];
    expect(copiedText).toContain('## Install');
    expect(copiedText).toContain(`\n\n---\n\n${postamble}`);
  });
});
