import {OrganizationFixture} from 'sentry-fixture/organization';

import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import {PlanFixture} from 'getsentry/__fixtures__/plan';
import {CronsOnDemandStepWarning} from 'getsentry/components/cronsOnDemandStepWarning';

describe('CronsOnDemandStepWarning', function () {
  const organization = OrganizationFixture();
  const subscription = SubscriptionFixture({organization, plan: 'am2_team'});

  it('shows warning only for insufficient funds', async function () {
    const plan = PlanFixture({});
    const url = `/organizations/${organization.slug}/monitor-count/`;
    const mockApiCall = MockApiClient.addMockResponse({
      url,
      body: {enabledMonitorCount: 5, disabledMonitorCount: 0},
    });

    // Allocating only 1 dollar
    const currentOnDemand = 100;
    const {rerender} = render(
      <CronsOnDemandStepWarning
        activePlan={plan}
        currentOnDemand={currentOnDemand}
        organization={organization}
        subscription={subscription}
      />,
      {organization}
    );

    expect(mockApiCall).toHaveBeenCalled();
    expect(
      await screen.findByText(
        "These changes will take effect at the start of your next billing cycle. Heads up that you're currently using $3.12 of Cron Monitors. These monitors will be turned off at the start of your next billing cycle unless you increase your on-demand budget."
      )
    ).toBeInTheDocument();

    // Allocating enough to support 4 cron monitors + 1 free
    const newOnDemand = 400;
    rerender(
      <CronsOnDemandStepWarning
        activePlan={plan}
        currentOnDemand={newOnDemand}
        organization={organization}
        subscription={subscription}
      />
    );

    expect(
      screen.queryByText(
        "These changes will take effect at the start of your next billing cycle. Heads up that you're currently using $3.12 of Cron Monitors. These monitors will be turned off at the start of your next billing cycle unless you increase your on-demand budget."
      )
    ).not.toBeInTheDocument();
  });
});
