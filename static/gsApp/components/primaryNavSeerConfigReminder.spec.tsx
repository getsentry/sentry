import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import {PrimaryNavSeerConfigReminder} from 'getsentry/components/primaryNavSeerConfigReminder';

describe('PrimaryNavSeerConfigReminder', () => {
  afterEach(() => {
    MockApiClient.clearMockResponses();
  });

  function mockOnboardingCheck(organizationSlug: string) {
    return MockApiClient.addMockResponse({
      url: `/organizations/${organizationSlug}/seer/onboarding-check/`,
      body: {
        hasSupportedScmIntegration: false,
        isAutofixEnabled: false,
        isCodeReviewEnabled: false,
        isSeerConfigured: false,
      },
    });
  }

  it.each(['seat-based-seer-enabled', 'token-billed-seer-enabled'])(
    'shows the reminder with %s',
    async feature => {
      const organization = OrganizationFixture({features: [feature]});
      mockOnboardingCheck(organization.slug);

      render(<PrimaryNavSeerConfigReminder />, {organization});

      expect(
        await screen.findByRole('button', {name: 'Configure Seer'})
      ).toBeInTheDocument();
    }
  );

  it('hides the reminder without a new Seer plan', async () => {
    const organization = OrganizationFixture({features: ['seer-added']});
    const onboardingCheck = mockOnboardingCheck(organization.slug);

    render(<PrimaryNavSeerConfigReminder />, {organization});

    await waitFor(() => expect(onboardingCheck).toHaveBeenCalled());
    expect(
      screen.queryByRole('button', {name: 'Configure Seer'})
    ).not.toBeInTheDocument();
  });
});
