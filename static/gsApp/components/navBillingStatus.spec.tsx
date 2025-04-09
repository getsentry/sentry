import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {TeamFixture} from 'sentry-fixture/team';
import {UserFixture} from 'sentry-fixture/user';

import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import ConfigStore from 'sentry/stores/configStore';

import PrimaryNavigationQuotaExceeded from 'getsentry/components/navBillingStatus';
import SubscriptionStore from 'getsentry/stores/subscriptionStore';

describe('PrimaryNavigationQuotaExceeded', function () {
  const organization = OrganizationFixture();
  const subscription = SubscriptionFixture({
    organization,
    plan: 'am3_business',
  });
  let promptMock: jest.Mock;
  let requestUpgradeMock: jest.Mock;
  let customerPutMock: jest.Mock;

  beforeEach(() => {
    organization.access = [];
    MockApiClient.clearMockResponses();
    subscription.categories.errors!.usageExceeded = true;
    subscription.categories.replays!.usageExceeded = true;
    subscription.categories.spans!.usageExceeded = true;
    subscription.categories.monitorSeats!.usageExceeded = true;
    subscription.categories.profileDuration!.usageExceeded = true;
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
      url: `/organizations/${organization.slug}/`,
      body: organization,
    });
    MockApiClient.addMockResponse({
      method: 'GET',
      url: `/organizations/${organization.slug}/teams/`,
      body: [TeamFixture()],
    });
    MockApiClient.addMockResponse({
      method: 'GET',
      url: `/organizations/${organization.slug}/projects/`,
      body: [ProjectFixture()],
    });
    MockApiClient.addMockResponse({
      method: 'GET',
      url: `/subscriptions/${organization.slug}/`,
      body: subscription,
    });
    MockApiClient.addMockResponse({
      method: 'GET',
      url: `/organizations/${organization.slug}/prompts-activity/`,
      body: {},
    });
    MockApiClient.addMockResponse({
      method: 'PUT',
      url: `/organizations/${organization.slug}/prompts-activity/`,
    });

    promptMock = MockApiClient.addMockResponse({
      method: 'PUT',
      url: `/organizations/${organization.slug}/prompts-activity/`,
      body: {},
    });
    requestUpgradeMock = MockApiClient.addMockResponse({
      method: 'POST',
      url: `/organizations/${organization.slug}/event-limit-increase-request/`,
      body: {},
    });
    customerPutMock = MockApiClient.addMockResponse({
      method: 'PUT',
      url: `/customers/${organization.slug}/`,
      body: SubscriptionFixture({organization}),
    });
  });

  it('should render', async function () {
    render(<PrimaryNavigationQuotaExceeded organization={organization} />);

    // open the alert
    await userEvent.click(await screen.findByRole('button', {name: 'Billing Status'}));
    expect(await screen.findByText('Quota Exceeded')).toBeInTheDocument();
    // doesn't show categories with <1 reserved tier and no PAYG
    expect(
      screen.getByText(
        /You’ve run out of errors, replays, and spans for this billing cycle./
      )
    ).toBeInTheDocument();
    expect(screen.queryByText(/cron monitors/)).not.toBeInTheDocument();
    expect(screen.queryByText(/continuous profile hours/)).not.toBeInTheDocument();
    expect(screen.getByRole('checkbox')).not.toBeChecked();
  });

  it('should render PAYG categories when there is PAYG', async function () {
    subscription.onDemandMaxSpend = 100;
    SubscriptionStore.set(organization.slug, subscription);
    render(<PrimaryNavigationQuotaExceeded organization={organization} />);

    // open the alert
    await userEvent.click(await screen.findByRole('button', {name: 'Billing Status'}));
    expect(await screen.findByText('Quota Exceeded')).toBeInTheDocument();
    expect(
      screen.getByText(
        /You’ve run out of errors, replays, spans, cron monitors, and continuous profile hours for this billing cycle./
      )
    ).toBeInTheDocument();
    expect(screen.getByRole('checkbox')).not.toBeChecked();

    // reset
    subscription.onDemandMaxSpend = 0;
  });

  it('should not render for managed orgs', function () {
    subscription.canSelfServe = false;
    SubscriptionStore.set(organization.slug, subscription);
    render(<PrimaryNavigationQuotaExceeded organization={organization} />);
    expect(
      screen.queryByRole('button', {name: 'Billing Status'})
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Quota Exceeded')).not.toBeInTheDocument();

    // reset
    subscription.canSelfServe = true;
  });

  it('should update prompts when checkbox is toggled', async function () {
    render(<PrimaryNavigationQuotaExceeded organization={organization} />);

    // open the alert
    await userEvent.click(await screen.findByRole('button', {name: 'Billing Status'}));
    expect(await screen.findByText('Quota Exceeded')).toBeInTheDocument();

    // stop the alert from animating
    await userEvent.click(screen.getByRole('checkbox'));
    expect(promptMock).toHaveBeenCalled();

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
    expect(promptMock).toHaveBeenCalled();

    // close and open again
    expect(screen.getByText('Quota Exceeded')).toBeInTheDocument();
    await userEvent.click(document.body);
    expect(screen.queryByText('Quota Exceeded')).not.toBeInTheDocument();
    await userEvent.click(await screen.findByRole('button', {name: 'Billing Status'}));
    expect(await screen.findByText('Quota Exceeded')).toBeInTheDocument();
    expect(screen.getByRole('checkbox')).not.toBeChecked();
  });

  it('should update prompts when non-billing user takes action', async function () {
    render(<PrimaryNavigationQuotaExceeded organization={organization} />);

    // open the alert
    await userEvent.click(await screen.findByRole('button', {name: 'Billing Status'}));
    expect(await screen.findByText('Quota Exceeded')).toBeInTheDocument();
    expect(screen.getByText('Request Additional Quota')).toBeInTheDocument();

    // click the button
    await userEvent.click(screen.getByText('Request Additional Quota'));
    expect(promptMock).toHaveBeenCalled();
    expect(requestUpgradeMock).toHaveBeenCalled();
    expect(screen.getByRole('checkbox')).toBeChecked();
  });

  it('should update prompts when billing user on free plan takes action', async function () {
    organization.access = ['org:billing'];
    const freeSub = SubscriptionFixture({
      organization,
      plan: 'am3_f',
    });
    freeSub.categories.replays!.usageExceeded = true;
    SubscriptionStore.set(organization.slug, freeSub);
    render(<PrimaryNavigationQuotaExceeded organization={organization} />);

    // open the alert
    await userEvent.click(await screen.findByRole('button', {name: 'Billing Status'}));
    expect(await screen.findByText('Quota Exceeded')).toBeInTheDocument();
    expect(screen.getByText('Start Trial')).toBeInTheDocument();

    // click the button
    await userEvent.click(screen.getByText('Start Trial'));
    expect(promptMock).toHaveBeenCalled();
    expect(customerPutMock).toHaveBeenCalled();
  });
});
