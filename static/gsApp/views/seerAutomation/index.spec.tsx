import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import SeerAutomationRoot from 'getsentry/views/seerAutomation';

describe('SeerAutomationRoot', () => {
  it('shows AI-disabled banner for active seat-based orgs with AI disabled', () => {
    const organization = OrganizationFixture({
      features: ['seat-based-seer-enabled'],
      hideAiFeatures: true,
    });

    render(<SeerAutomationRoot />, {organization});

    expect(
      screen.getByText('Generative AI features are disabled for your organization.')
    ).toBeInTheDocument();
  });

  it('shows no-access screen for non-seat-based orgs with AI disabled', () => {
    const organization = OrganizationFixture({
      features: ['code-review-beta'],
      hideAiFeatures: true,
    });

    render(<SeerAutomationRoot />, {organization});

    expect(screen.getByText("You don't have access to this feature")).toBeInTheDocument();
  });

  it('renders outlet content for active seat-based orgs when AI features are enabled', () => {
    const organization = OrganizationFixture({
      features: ['seat-based-seer-enabled'],
      hideAiFeatures: false,
    });

    render(<SeerAutomationRoot />, {organization});

    expect(
      screen.queryByText('Generative AI features are disabled for your organization.')
    ).not.toBeInTheDocument();
  });
});
