import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {TeamFixture} from 'sentry-fixture/team';

import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';
import {resetMockDate, setMockDate} from 'sentry-test/utils';

import PrimaryNavigationQuotaExceeded from 'getsentry/components/navBillingStatus';
import SubscriptionStore from 'getsentry/stores/subscriptionStore';
import {OnDemandBudgetMode} from 'getsentry/types';

// Jun 06 2022 - with milliseconds
const MOCK_TODAY = 1654492173000;

//  prompts activity timestamps do not include milliseconds
const MOCK_PERIOD_START = 1652140800; // May 10 2022
const MOCK_BEFORE_PERIOD_START = 1652054400; // May 09 2022

describe('PrimaryNavigationQuotaExceeded', () => {
  const organization = OrganizationFixture();
  const subscription = SubscriptionFixture({
    organization,
    plan: 'am3_business',
    onDemandPeriodStart: '2022-05-10',
    onDemandPeriodEnd: '2022-06-09',
  });
  let promptMock: jest.Mock;
  let requestUpgradeMock: jest.Mock;
  let customerPutMock: jest.Mock;

  beforeEach(() => {
    setMockDate(MOCK_TODAY);
    localStorage.clear();
    organization.access = [];
    subscription.categories.errors!.usageExceeded = true;
    subscription.categories.replays!.usageExceeded = true;
    subscription.categories.spans!.usageExceeded = true;
    subscription.categories.monitorSeats!.usageExceeded = true;
    subscription.categories.profileDuration!.usageExceeded = true;
    SubscriptionStore.set(organization.slug, subscription);
    MockApiClient.clearMockResponses();

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
      url: `/organizations/${organization.slug}/prompts-activity/`,
      body: {},
    });
    promptMock = MockApiClient.addMockResponse({
      method: 'PUT',
      url: `/organizations/${organization.slug}/prompts-activity/`,
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

    // set localStorage to prevent auto-popup
    localStorage.setItem(
      `billing-status-last-shown-categories-${organization.id}`,
      'errors-replays-spans-profileDuration' // exceeded categories
    );
    localStorage.setItem(
      `billing-status-last-shown-date-${organization.id}`,
      'Mon Jun 06 2022' // MOCK_TODAY
    );
  });

  afterEach(() => {
    resetMockDate();
  });

  function assertLocalStorageStateAfterAutoOpen() {
    expect(
      localStorage.getItem(`billing-status-last-shown-categories-${organization.id}`)
    ).toBe('errors-replays-spans-profileDuration');
    expect(
      localStorage.getItem(`billing-status-last-shown-date-${organization.id}`)
    ).toBe('Mon Jun 06 2022');
  }

  it('should render for multiple categories', async () => {
    render(<PrimaryNavigationQuotaExceeded organization={organization} />);

    // open the alert
    await userEvent.click(await screen.findByRole('button', {name: 'Billing Status'}));
    expect(await screen.findByText('Quotas Exceeded')).toBeInTheDocument();
    // doesn't show categories with <=1 reserved tier and no PAYG
    expect(
      screen.getByText(
        /You have used up your quota for errors, replays, spans, and continuous profile hours. Monitoring and new data for these features are paused until your quota resets./
      )
    ).toBeInTheDocument();
    expect(screen.queryByText(/cron monitors/)).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', {
        name: 'Dismiss alert for the rest of the billing cycle',
      })
    ).toBeInTheDocument();
  });

  it('should render for single category', async () => {
    const newSub = SubscriptionFixture({
      organization,
      plan: 'am3_team',
    });
    newSub.categories.errors!.usageExceeded = true;
    newSub.categories.monitorSeats!.usageExceeded = true;
    SubscriptionStore.set(organization.slug, newSub);
    localStorage.setItem(
      `billing-status-last-shown-categories-${organization.id}`,
      'errors' // exceeded categories
    );
    render(<PrimaryNavigationQuotaExceeded organization={organization} />);

    // open the alert
    await userEvent.click(await screen.findByRole('button', {name: 'Billing Status'}));

    expect(await screen.findByText('Error Quota Exceeded')).toBeInTheDocument();
    expect(
      screen.getByText(
        /You have used up your quota for errors. Monitoring and new data are paused until your quota resets./
      )
    ).toBeInTheDocument(); // doesn't show categories with <=1 reserved tier and no PAYG
    expect(
      screen.getByRole('button', {
        name: 'Dismiss alert for the rest of the billing cycle',
      })
    ).toBeInTheDocument();
  });

  it('should not render for zero categories', () => {
    const newSub = SubscriptionFixture({
      organization,
      plan: 'am3_team',
    });
    // these categories are PAYG categories and there is no PAYG, so they should not trigger the alert
    newSub.categories.monitorSeats!.usageExceeded = true;
    newSub.categories.profileDuration!.usageExceeded = true;
    SubscriptionStore.set(organization.slug, newSub);
    localStorage.clear();
    render(<PrimaryNavigationQuotaExceeded organization={organization} />);
    expect(
      screen.queryByRole('button', {name: 'Billing Status'})
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Quotas Exceeded')).not.toBeInTheDocument();
  });

  it('should render PAYG categories when there is shared PAYG', async () => {
    localStorage.setItem(
      `billing-status-last-shown-categories-${organization.id}`,
      'errors-replays-spans-monitorSeats-profileDuration' // exceeded categories
    );
    subscription.onDemandMaxSpend = 100;
    SubscriptionStore.set(organization.slug, subscription);
    render(<PrimaryNavigationQuotaExceeded organization={organization} />);

    // open the alert
    await userEvent.click(await screen.findByRole('button', {name: 'Billing Status'}));
    expect(await screen.findByText('Quotas Exceeded')).toBeInTheDocument();
    expect(
      screen.getByText(
        /You have used up your quota for errors, replays, spans, and continuous profile hours./
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText(/You have also reached your quota for cron monitors./)
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', {
        name: 'Dismiss alert for the rest of the billing cycle',
      })
    ).toBeInTheDocument();

    // reset
    subscription.onDemandMaxSpend = 0;
  });

  it('should render PAYG categories with per category PAYG', async () => {
    localStorage.setItem(
      `billing-status-last-shown-categories-${organization.id}`,
      'errors-replays-spans-monitorSeats-profileDuration' // exceeded categories
    );
    subscription.onDemandBudgets = {
      budgetMode: OnDemandBudgetMode.PER_CATEGORY,
      budgets: {
        monitorSeats: 100,
      },
      usedSpends: {},
      enabled: true,
    };
    SubscriptionStore.set(organization.slug, subscription);
    render(<PrimaryNavigationQuotaExceeded organization={organization} />);

    // open the alert
    await userEvent.click(await screen.findByRole('button', {name: 'Billing Status'}));
    expect(await screen.findByText('Quotas Exceeded')).toBeInTheDocument();
    expect(
      screen.getByText(
        /You have used up your quota for errors, replays, spans, and continuous profile hours./
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText(/You have also reached your quota for cron monitors./)
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', {
        name: 'Dismiss alert for the rest of the billing cycle',
      })
    ).toBeInTheDocument();

    // reset
    subscription.onDemandMaxSpend = 0;
    subscription.onDemandBudgets = undefined;
  });

  it('should not render for managed orgs', () => {
    subscription.canSelfServe = false;
    SubscriptionStore.set(organization.slug, subscription);
    render(<PrimaryNavigationQuotaExceeded organization={organization} />);
    expect(
      screen.queryByRole('button', {name: 'Billing Status'})
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Quotas Exceeded')).not.toBeInTheDocument();

    // reset
    subscription.canSelfServe = true;
  });

  it('should update prompts when dismissed', async () => {
    render(<PrimaryNavigationQuotaExceeded organization={organization} />);

    // open the alert
    await userEvent.click(await screen.findByRole('button', {name: 'Billing Status'}));
    expect(await screen.findByText('Quotas Exceeded')).toBeInTheDocument();

    // stop the alert from animating
    await userEvent.click(
      screen.getByRole('button', {
        name: 'Dismiss alert for the rest of the billing cycle',
      })
    );
    expect(promptMock).toHaveBeenCalledTimes(4); // one for each category
  });

  it('should update prompts when non-billing user takes action', async () => {
    render(<PrimaryNavigationQuotaExceeded organization={organization} />);

    // open the alert
    await userEvent.click(await screen.findByRole('button', {name: 'Billing Status'}));
    expect(await screen.findByText('Quotas Exceeded')).toBeInTheDocument();
    expect(screen.getByText('Request Additional Quota')).toBeInTheDocument();

    // click the button
    await userEvent.click(screen.getByText('Request Additional Quota'));
    expect(promptMock).toHaveBeenCalledTimes(4);
    expect(requestUpgradeMock).toHaveBeenCalled();
  });

  it('should update prompts when billing user on free plan takes action', async () => {
    organization.access = ['org:billing'];
    const freeSub = SubscriptionFixture({
      organization,
      plan: 'am3_f',
    });
    freeSub.categories.errors!.usageExceeded = true;
    freeSub.categories.replays!.usageExceeded = true;
    SubscriptionStore.set(organization.slug, freeSub);
    localStorage.setItem(
      `billing-status-last-shown-categories-${organization.id}`,
      'errors-replays'
    );
    MockApiClient.addMockResponse({
      method: 'GET',
      url: `/subscriptions/${organization.slug}/`,
      body: freeSub,
    });

    render(<PrimaryNavigationQuotaExceeded organization={organization} />);

    // open the alert
    await userEvent.click(await screen.findByRole('button', {name: 'Billing Status'}));
    expect(await screen.findByText('Quotas Exceeded')).toBeInTheDocument();
    expect(screen.getByText('Start Trial')).toBeInTheDocument();

    // click the button
    await userEvent.click(screen.getByText('Start Trial'));
    expect(promptMock).toHaveBeenCalledTimes(2);
    expect(customerPutMock).toHaveBeenCalled();
  });

  it('should auto open based on localStorage', async () => {
    render(<PrimaryNavigationQuotaExceeded organization={organization} />);
    expect(
      await screen.findByRole('button', {name: 'Billing Status'})
    ).toBeInTheDocument();
    expect(screen.queryByText('Quotas Exceeded')).not.toBeInTheDocument();

    localStorage.clear();
    render(<PrimaryNavigationQuotaExceeded organization={organization} />);
    expect(
      await screen.findByRole('button', {name: 'Billing Status'})
    ).toBeInTheDocument();
    expect(await screen.findByText('Quotas Exceeded')).toBeInTheDocument();
    assertLocalStorageStateAfterAutoOpen();
  });

  it('should not auto open if explicitly dismissed', async () => {
    MockApiClient.addMockResponse({
      method: 'GET',
      url: `/organizations/${organization.slug}/prompts-activity/`,
      body: {
        features: {
          errors_overage_alert: {
            snoozed_ts: MOCK_PERIOD_START,
          },
          replays_overage_alert: {
            snoozed_ts: MOCK_PERIOD_START,
          },
          spans_overage_alert: {
            snoozed_ts: MOCK_PERIOD_START,
          },
          profile_duration_overage_alert: {
            snoozed_ts: MOCK_PERIOD_START,
          },
        },
      }, // dismissed at beginning of billing cycle
    });
    render(<PrimaryNavigationQuotaExceeded organization={organization} />);
    expect(
      await screen.findByRole('button', {name: 'Billing Status'})
    ).toBeInTheDocument();
    expect(screen.queryByText('Quotas Exceeded')).not.toBeInTheDocument();

    // even when localStorage is cleared, the alert should not show
    localStorage.clear();
    render(<PrimaryNavigationQuotaExceeded organization={organization} />);
    expect(
      await screen.findByRole('button', {name: 'Billing Status'})
    ).toBeInTheDocument();
    expect(screen.queryByText('Quotas Exceeded')).not.toBeInTheDocument();
    expect(localStorage).toHaveLength(0);
  });

  it('should auto open if explicitly dismissed before current billing cycle', async () => {
    MockApiClient.addMockResponse({
      method: 'GET',
      url: `/organizations/${organization.slug}/prompts-activity/`,
      body: {
        features: {
          errors_overage_alert: {
            snoozed_ts: MOCK_BEFORE_PERIOD_START,
          },
          replays_overage_alert: {
            snoozed_ts: MOCK_BEFORE_PERIOD_START,
          },
          spans_overage_alert: {
            snoozed_ts: MOCK_BEFORE_PERIOD_START,
          },
        },
      }, // dismissed on last day before current billing cycle
    });
    localStorage.clear();
    render(<PrimaryNavigationQuotaExceeded organization={organization} />);
    expect(await screen.findByText('Quotas Exceeded')).toBeInTheDocument();
  });

  it('should auto open the alert when categories have changed', async () => {
    render(<PrimaryNavigationQuotaExceeded organization={organization} />);
    expect(screen.queryByText('Quotas Exceeded')).not.toBeInTheDocument();

    localStorage.setItem(
      `billing-status-last-shown-categories-${organization.id}`,
      'errors-replays'
    ); // spans not included, so alert should show even though last opened "today"
    render(<PrimaryNavigationQuotaExceeded organization={organization} />);
    expect(await screen.findByText('Quotas Exceeded')).toBeInTheDocument();
    assertLocalStorageStateAfterAutoOpen();
  });

  it('should auto open the alert when more than a day has passed', async () => {
    localStorage.setItem(
      `billing-status-last-shown-date-${organization.id}`,
      'Sun Jun 05 2022'
    ); // more than a day, so alert should show even though categories haven't changed
    render(<PrimaryNavigationQuotaExceeded organization={organization} />);
    expect(await screen.findByText('Quotas Exceeded')).toBeInTheDocument();
    assertLocalStorageStateAfterAutoOpen();
  });

  it('should auto open the alert when the last shown date is before the current usage cycle started', async () => {
    localStorage.setItem(
      `billing-status-last-shown-date-${organization.id}`,
      'Sun May 29 2022'
    ); // last seen before current usage cycle started, so alert should show even though categories haven't changed
    render(<PrimaryNavigationQuotaExceeded organization={organization} />);
    expect(await screen.findByText('Quotas Exceeded')).toBeInTheDocument();
    assertLocalStorageStateAfterAutoOpen();
  });
});
