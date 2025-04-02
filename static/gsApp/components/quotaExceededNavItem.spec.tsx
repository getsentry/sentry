import {OrganizationFixture} from 'sentry-fixture/organization';
import {UserFixture} from 'sentry-fixture/user';

import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import ConfigStore from 'sentry/stores/configStore';

import PrimaryNavigationQuotaExceeded from 'getsentry/components/quotaExceededNavItem';
import SubscriptionStore from 'getsentry/stores/subscriptionStore';

describe('PrimaryNavigationQuotaExceeded', function () {
  const organization = OrganizationFixture();

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    const subscription = SubscriptionFixture({
      organization,
      plan: 'am3_business',
    });
    subscription.categories.errors!.usageExceeded = true;
    subscription.categories.replays!.usageExceeded = true;
    subscription.categories.spans!.usageExceeded = true;
    SubscriptionStore.set(organization.slug, subscription);
    ConfigStore.set(
      'user',
      UserFixture({
        options: {
          ...UserFixture().options,
          prefersStackedNavigation: true,
        },
      })
    );

    MockApiClient.addMockResponse({
      method: 'GET',
      url: `/subscriptions/${organization.slug}/`,
      body: {},
    });
  });

  it('should render', async function () {
    MockApiClient.addMockResponse({
      method: 'GET',
      url: `/organizations/${organization.slug}/prompts-activity/`,
      body: {},
      query: {
        feature: ['errors_overage_alert', 'replays_overage_alert', 'spans_overage_alert'],
        organization_id: organization.id,
      },
    });
    MockApiClient.addMockResponse({
      method: 'PUT',
      url: `/organizations/${organization.slug}/prompts-activity/`,
      body: {},
    });

    render(<PrimaryNavigationQuotaExceeded organization={organization} />);

    // open the alert
    await userEvent.click(await screen.findByRole('button', {name: 'Billing Overage'}));

    expect(await screen.findByText('Quota Exceeded')).toBeInTheDocument();
    expect(
      screen.getByText(
        /You’ve run out of errors, replays, and spans for this billing cycle./
      )
    ).toBeInTheDocument();
    expect(screen.getByRole('checkbox')).not.toBeChecked();

    // close the alert
    await userEvent.click(screen.getByRole('checkbox'));
    expect(screen.queryByText('Quota Exceeded')).not.toBeInTheDocument();
  });
});
