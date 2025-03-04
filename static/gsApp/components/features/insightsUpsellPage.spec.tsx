import {OrganizationFixture} from 'sentry-fixture/organization';

import {BillingConfigFixture} from 'getsentry-test/fixtures/billingConfig';
import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import type {TitleableModuleNames} from 'sentry/views/insights/common/components/modulePageProviders';

import {InsightsUpsellPage} from 'getsentry/components/features/insightsUpsellPage';
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

    subscription.planDetails.features = [];
  });

  it('renders module if plan includes feature', async function () {
    subscription.planDetails.features = [
      'insights-initial-modules',
      'insights-addon-modules',
    ];

    render(
      <InsightsUpsellPage
        organization={organization}
        subscription={subscription}
        moduleName={'db'}
      >
        <span>db module content</span>
      </InsightsUpsellPage>
    );

    expect(await screen.findByText('db module content')).toBeInTheDocument();
  });

  it('renders upselling if feature is not included in plan', function () {
    render(
      <InsightsUpsellPage
        organization={organization}
        subscription={subscription}
        moduleName={'db'}
      >
        <span>db module content</span>
      </InsightsUpsellPage>
    );

    expect(screen.queryByText('db module content')).not.toBeInTheDocument();
  });

  it('renders module if no upselling exists', async function () {
    // let's assume there's a module in sentry, which has no upselling content in getsentry
    const unknownModuleName = 'new-fancy-feature' as TitleableModuleNames;

    render(
      <InsightsUpsellPage
        organization={organization}
        subscription={subscription}
        moduleName={unknownModuleName}
      >
        <span>new-fancy-feature</span>
      </InsightsUpsellPage>
    );

    expect(await screen.findByText('new-fancy-feature')).toBeInTheDocument();
  });
});
