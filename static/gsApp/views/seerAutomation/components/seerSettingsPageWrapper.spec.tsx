import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import SeerSettingsPageWrapper from 'getsentry/views/seerAutomation/components/seerSettingsPageWrapper';

describe('SeerSettingsPageWrapper', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('shows settings when feature flag is enabled', async () => {
    const org = OrganizationFixture({
      features: [
        'seat-based-seer-enabled',
        'seer-user-billing',
        'seer-user-billing-launch',
      ],
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/seer/onboarding-check/`,
      method: 'GET',
      body: {
        setupAcknowledgement: {orgHasAcknowledged: true, userHasAcknowledged: true},
        billing: {hasAutofixQuota: true, hasScannerQuota: true},
      },
    });

    render(
      <SeerSettingsPageWrapper>
        <div data-test-id="settings-content">Settings Content</div>
      </SeerSettingsPageWrapper>,
      {organization: org}
    );

    expect(await screen.findByTestId('settings-content')).toBeInTheDocument();
    expect(screen.getByText('Seer')).toBeInTheDocument();
  });

  it('shows settings when no feature flag but has billed seats', async () => {
    const org = OrganizationFixture({
      features: ['seer-user-billing', 'seer-user-billing-launch'],
    });

    MockApiClient.addMockResponse({
      url: `/customers/${org.slug}/billing-seats/current/?billingMetric=seerUsers`,
      method: 'GET',
      body: [{id: '1', displayName: 'user1', created: new Date().toISOString()}],
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/seer/onboarding-check/`,
      method: 'GET',
      body: {
        setupAcknowledgement: {orgHasAcknowledged: true, userHasAcknowledged: true},
        billing: {hasAutofixQuota: true, hasScannerQuota: true},
      },
    });

    render(
      <SeerSettingsPageWrapper>
        <div data-test-id="settings-content">Settings Content</div>
      </SeerSettingsPageWrapper>,
      {organization: org}
    );

    expect(await screen.findByTestId('settings-content')).toBeInTheDocument();
  });

  it('shows no access when no feature flag and no billed seats', async () => {
    const org = OrganizationFixture({
      features: ['seer-user-billing', 'seer-user-billing-launch'],
    });

    MockApiClient.addMockResponse({
      url: `/customers/${org.slug}/billing-seats/current/?billingMetric=seerUsers`,
      method: 'GET',
      body: [],
    });

    render(
      <SeerSettingsPageWrapper>
        <div data-test-id="settings-content">Settings Content</div>
      </SeerSettingsPageWrapper>,
      {organization: org}
    );

    expect(
      await screen.findByText("You don't have access to this feature")
    ).toBeInTheDocument();
  });
});
