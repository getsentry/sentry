import moment from 'moment-timezone';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {BillingConfigFixture} from 'getsentry-test/fixtures/billingConfig';
import {PlanDetailsLookupFixture} from 'getsentry-test/fixtures/planDetailsLookup';
import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import {CronsBillingBanner} from 'getsentry/components/crons/cronsBillingBanner';
import {PlanTier} from 'getsentry/types';

describe('CronsBillingBanner', function () {
  beforeEach(() => {
    const organization = OrganizationFixture();
    const billingConfig = BillingConfigFixture(PlanTier.AM2);
    const plan = billingConfig.planList.find(p => p.id === 'am2_business');
    // TODO(davidenwang): Add monitorSeats to all test fixtures
    if (plan) {
      plan.planCategories.monitorSeats = [
        {
          events: 1,
          unitPrice: 0,
          price: 0,
          onDemandPrice: 78,
        },
      ];
    }
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/billing-config/`,
      body: billingConfig,
    });
  });

  it('Shows warning when trial is about to end', async function () {
    const now = moment();
    const trialEnd = now.add(5, 'days').toString();
    const organization = OrganizationFixture();
    const subscription = SubscriptionFixture({
      organization,
      trialEnd,
      isTrial: true,
    });

    const mockApiCall = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/monitor-count/`,
      body: {enabledMonitorCount: 5, disabledMonitorCount: 0},
    });

    const {rerender} = render(
      <CronsBillingBanner organization={organization} subscription={subscription} />
    );
    expect(mockApiCall).toHaveBeenCalled();
    expect(
      await screen.findByText(
        "Your organization's free business trial ends in 5 days. To continue monitoring your cron jobs, ask your organization's owner or billing manager to set an on-demand budget for cron monitoring."
      )
    ).toBeInTheDocument();

    const organizationWithBillingAccess = OrganizationFixture({access: ['org:billing']});
    rerender(
      <CronsBillingBanner
        organization={organizationWithBillingAccess}
        subscription={subscription}
      />
    );
    expect(
      await screen.findByText(
        "Your organization's free business trial ends in 5 days. To continue monitoring your cron jobs, make sure your on-demand budget is set to a minimum of $3.12."
      )
    ).toBeInTheDocument();
  });

  it('Shows warning when trial has ended', async function () {
    const now = moment();
    const lastTrialEnd = now.subtract(5, 'days').toString();
    const organization = OrganizationFixture();
    const subscription = SubscriptionFixture({
      organization,
      lastTrialEnd,
    });

    const mockApiCall = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/monitor-count/`,
      body: {enabledMonitorCount: 5, disabledMonitorCount: 0},
    });

    const {rerender} = render(
      <CronsBillingBanner organization={organization} subscription={subscription} />
    );

    expect(mockApiCall).toHaveBeenCalled();
    expect(
      await screen.findByText(
        "Your free business trial has ended. One cron job monitor is included in your current plan. If you want to monitor more than one cron job, please ask your organization's owner or billing manager to set up an on-demand budget for cron monitoring."
      )
    ).toBeInTheDocument();

    const organizationWithBillingAccess = OrganizationFixture({access: ['org:billing']});
    rerender(
      <CronsBillingBanner
        organization={organizationWithBillingAccess}
        subscription={subscription}
      />
    );
    expect(
      await screen.findByText(
        'Your free business trial has ended. One cron job monitor is included in your current plan. If you want to monitor more than one cron job, please increase your on-demand budget.'
      )
    ).toBeInTheDocument();
  });

  it('Shows alert when monitors have been disabled due to on-demand overage', async function () {
    const organization = OrganizationFixture();
    const am2BusinessPlan = PlanDetailsLookupFixture('am2_business');
    const subscription = SubscriptionFixture({
      organization,
      planDetails: am2BusinessPlan,
    });

    const mockApiCall = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/monitor-count/`,
      body: {enabledMonitorCount: 0, disabledMonitorCount: 0, overQuotaMonitorCount: 5},
    });

    const {rerender} = render(
      <CronsBillingBanner organization={organization} subscription={subscription} />
    );

    expect(mockApiCall).toHaveBeenCalled();
    expect(
      await screen.findByText(
        "Your organization doesn't have sufficient on-demand budget to cover your active cron job monitors. To continue monitoring your jobs, ask your organization's owner or billing manager to increase your on-demand budget or reduce your active monitors."
      )
    ).toBeInTheDocument();

    const organizationWithBillingAccess = OrganizationFixture({access: ['org:billing']});
    rerender(
      <CronsBillingBanner
        organization={organizationWithBillingAccess}
        subscription={subscription}
      />
    );
    expect(
      await screen.findByText(
        "Your organization doesn't have sufficient on-demand budget to cover your active cron job monitors. To continue monitoring your jobs, increase your on-demand budget or reduce your active monitors."
      )
    ).toBeInTheDocument();
  });
});
