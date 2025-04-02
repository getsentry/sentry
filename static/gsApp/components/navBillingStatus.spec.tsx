import {OrganizationFixture} from 'sentry-fixture/organization';
import {UserFixture} from 'sentry-fixture/user';

import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import ConfigStore from 'sentry/stores/configStore';

import PrimaryNavigationQuotaExceeded from 'getsentry/components/navBillingStatus';
import SubscriptionStore from 'getsentry/stores/subscriptionStore';

describe('PrimaryNavigationQuotaExceeded', function () {
  const organization = OrganizationFixture();
  let mock: jest.Mock;

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
    MockApiClient.addMockResponse({
      method: 'GET',
      url: `/organizations/${organization.slug}/prompts-activity/`,
      body: {},
    });
    MockApiClient.addMockResponse({
      method: 'PUT',
      url: `/organizations/${organization.slug}/prompts-activity/`,
      body: {},
    });
  });

  it('should render', async function () {
    render(<PrimaryNavigationQuotaExceeded organization={organization} />);

    // open the alert
    await userEvent.click(await screen.findByRole('button', {name: 'Billing Status'}));
    expect(await screen.findByText('Quota Exceeded')).toBeInTheDocument();
    expect(
      screen.getByText(
        /You’ve run out of errors, replays, and spans for this billing cycle./
      )
    ).toBeInTheDocument();
    expect(screen.getByRole('checkbox')).not.toBeChecked();
  });

  it('should update prompts when checkbox is toggled', async function () {
    mock = MockApiClient.addMockResponse({
      method: 'PUT',
      url: `/organizations/${organization.slug}/prompts-activity/`,
      body: {},
    });
    render(<PrimaryNavigationQuotaExceeded organization={organization} />);

    // open the alert
    await userEvent.click(await screen.findByRole('button', {name: 'Billing Status'}));
    expect(await screen.findByText('Quota Exceeded')).toBeInTheDocument();

    // stop the alert from animating
    await userEvent.click(screen.getByRole('checkbox'));
    expect(mock).toHaveBeenCalled();

    // overlay is still visible, need to click out to close
    expect(screen.getByText('Quota Exceeded')).toBeInTheDocument();
    await userEvent.click(document.body);
    expect(screen.queryByText('Quota Exceeded')).not.toBeInTheDocument();

    // open again
    await userEvent.click(await screen.findByRole('button', {name: 'Billing Status'}));
    expect(await screen.findByText('Quota Exceeded')).toBeInTheDocument();
    expect(screen.getByRole('checkbox')).toBeChecked();

    // uncheck the checkbox
    await userEvent.click(screen.getByRole('checkbox'));
    expect(mock).toHaveBeenCalled();

    // close and open again
    expect(screen.getByText('Quota Exceeded')).toBeInTheDocument();
    await userEvent.click(document.body);
    expect(screen.queryByText('Quota Exceeded')).not.toBeInTheDocument();
    await userEvent.click(await screen.findByRole('button', {name: 'Billing Status'}));
    expect(await screen.findByText('Quota Exceeded')).toBeInTheDocument();
    expect(screen.getByRole('checkbox')).not.toBeChecked();
  });
});
