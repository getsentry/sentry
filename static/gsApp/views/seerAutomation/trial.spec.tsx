import {OrganizationFixture} from 'sentry-fixture/organization';

import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import SubscriptionStore from 'getsentry/stores/subscriptionStore';
import SeerAutomationTrial from 'getsentry/views/seerAutomation/trial';

describe('SeerAutomationTrial', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('shows trial page when no feature flag and no billed seats', async () => {
    const org = OrganizationFixture({
      features: ['seer-user-billing', 'seer-user-billing-launch'],
    });
    const sub = SubscriptionFixture({organization: org});
    SubscriptionStore.set(org.slug, sub);

    MockApiClient.addMockResponse({
      url: `/customers/${org.slug}/billing-seats/current/?billingMetric=seerUsers`,
      method: 'GET',
      body: [],
    });

    render(<SeerAutomationTrial />, {organization: org});

    expect(await screen.findByText('Say Hello to a Smarter Sentry')).toBeInTheDocument();
    expect(screen.getByText('Try Out Seer Now')).toBeInTheDocument();
  });

  it('shows request upgrade alert when user lacks billing access', async () => {
    const org = OrganizationFixture({
      features: ['seer-user-billing', 'seer-user-billing-launch'],
      access: [],
    });
    const sub = SubscriptionFixture({organization: org, canSelfServe: false});
    SubscriptionStore.set(org.slug, sub);

    MockApiClient.addMockResponse({
      url: `/customers/${org.slug}/billing-seats/current/?billingMetric=seerUsers`,
      method: 'GET',
      body: [],
    });

    render(<SeerAutomationTrial />, {organization: org});

    expect(await screen.findByText('Say Hello to a Smarter Sentry')).toBeInTheDocument();
    expect(
      screen.getByText(/you need to be a billing member to try out seer/i)
    ).toBeInTheDocument();
  });
});
