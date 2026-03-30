import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import SeerAutomation from 'getsentry/views/seerAutomation/seerAutomation';

describe('SeerAutomation', () => {
  beforeEach(() => {
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/seer/onboarding-check/`,
      method: 'GET',
      body: {
        hasSupportedScmIntegration: true,
        isAutofixEnabled: true,
        isCodeReviewEnabled: true,
        isSeerConfigured: true,
      },
    });
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/config/integrations/`,
      method: 'GET',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/integrations/`,
      method: 'GET',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/repos/`,
      method: 'GET',
      body: [],
    });
  });

  it('shows no-active-subscription banner inline for legacy Seer cohorts', () => {
    const organization = OrganizationFixture({
      features: ['code-review-beta'],
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/seer/onboarding-check/`,
      method: 'GET',
      body: {
        hasSupportedScmIntegration: true,
        isAutofixEnabled: true,
        isCodeReviewEnabled: true,
        isSeerConfigured: true,
      },
    });

    render(<SeerAutomation />, {organization});

    expect(
      screen.getByText('You are using an older Seer experience.')
    ).toBeInTheDocument();
  });

  it('does not show legacy banner for orgs without legacy or beta Seer features', () => {
    const organization = OrganizationFixture({
      features: [],
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/seer/onboarding-check/`,
      method: 'GET',
      body: {
        hasSupportedScmIntegration: true,
        isAutofixEnabled: false,
        isCodeReviewEnabled: false,
        isSeerConfigured: false,
      },
    });

    render(<SeerAutomation />, {organization});

    expect(
      screen.queryByText('You are using an older Seer experience.')
    ).not.toBeInTheDocument();
  });

  it('can update the org default autofix automation tuning setting', async () => {
    const organization = OrganizationFixture({
      features: ['seat-based-seer-enabled'],
      defaultAutofixAutomationTuning: 'off',
    });

    const orgPutRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/`,
      method: 'PUT',
      body: OrganizationFixture({
        defaultAutofixAutomationTuning: 'medium',
      }),
    });

    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/seer/onboarding-check/`,
      method: 'GET',
      body: {
        hasSupportedScmIntegration: true,
        isAutofixEnabled: true,
        isCodeReviewEnabled: true,
        isSeerConfigured: true,
      },
    });

    render(<SeerAutomation />, {organization});

    const toggle = await screen.findByRole('checkbox', {
      name: /Auto-Trigger Fixes by Default/i,
    });
    expect(toggle).not.toBeChecked();
    await userEvent.click(toggle);

    await waitFor(() => {
      expect(orgPutRequest).toHaveBeenCalledTimes(1);
    });
    expect(orgPutRequest).toHaveBeenCalledWith(
      `/organizations/${organization.slug}/`,
      expect.objectContaining({
        data: {defaultAutofixAutomationTuning: 'medium'},
      })
    );
  });

  it('can update default code review setting', async () => {
    const organization = OrganizationFixture({
      features: ['seat-based-seer-enabled'],
      autoEnableCodeReview: false,
    });

    const orgPutRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/`,
      method: 'PUT',
      body: OrganizationFixture({
        autoEnableCodeReview: true,
      }),
    });

    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/seer/onboarding-check/`,
      method: 'GET',
      body: {
        hasSupportedScmIntegration: true,
        isAutofixEnabled: true,
        isCodeReviewEnabled: true,
        isSeerConfigured: true,
      },
    });

    render(<SeerAutomation />, {organization});

    const toggle = await screen.findByRole('checkbox', {
      name: /Enable Code Review by Default/i,
    });
    expect(toggle).toBeInTheDocument();
    expect(toggle).not.toBeChecked();

    // Toggle it on
    await userEvent.click(toggle);

    await waitFor(() => {
      expect(orgPutRequest).toHaveBeenCalledTimes(1);
    });
    expect(orgPutRequest).toHaveBeenCalledWith(
      `/organizations/${organization.slug}/`,
      expect.objectContaining({
        data: {autoEnableCodeReview: true},
      })
    );
  });
});
