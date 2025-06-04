import {OrganizationFixture} from 'sentry-fixture/organization';

import {BillingConfigFixture} from 'getsentry-test/fixtures/billingConfig';
import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import {InsightsDateRangeQueryLimitFooter} from 'getsentry/components/features/insightsDateRangeQueryLimitFooter';
import {PlanTier} from 'getsentry/types';

describe('InsightsUpsellPage', function () {
  const organization = OrganizationFixture();
  const subscription = SubscriptionFixture({
    organization,
    plan: 'am3_team',
    isFree: true,
    planTier: PlanTier.AM3,
  });

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/billing-config/`,
      body: BillingConfigFixture(PlanTier.AM3),
    });
    MockApiClient.addMockResponse({
      url: `/subscriptions/org-slug/`,
      body: {},
    });

    subscription.planDetails.features = [];
  });

  it('renders if plan includes feature', async function () {
    subscription.planDetails.features = ['insights-query-date-range-limit'];

    render(
      <InsightsDateRangeQueryLimitFooter
        organization={organization}
        subscription={subscription}
      />
    );

    expect(
      await screen.findByText(
        'To view more trends for your Performance data, upgrade to Business.'
      )
    ).toBeInTheDocument();
  });

  it('does not render if feature is not included', function () {
    render(
      <InsightsDateRangeQueryLimitFooter
        organization={organization}
        subscription={subscription}
      />
    );

    expect(
      screen.queryByText(
        'To view more trends for your Performance data, upgrade to Business.'
      )
    ).not.toBeInTheDocument();
  });
});
