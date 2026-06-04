import {OrganizationFixture} from 'sentry-fixture/organization';

import {BillingHistoryFixture} from 'getsentry-test/fixtures/billingHistory';
import {CustomerUsageFixture} from 'getsentry-test/fixtures/customerUsage';
import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {DataCategory} from 'sentry/types/core';
import * as useMedia from 'sentry/utils/useMedia';
import {SecondaryNavigationContextProvider} from 'sentry/views/navigation/secondaryNavigationContext';

import {UNLIMITED_RESERVED} from 'getsentry/constants';
import {SubscriptionStore} from 'getsentry/stores/subscriptionStore';
import {UsageOverview} from 'getsentry/views/subscriptionPage/usageOverview';

describe('UsageOverview', () => {
  const organization = OrganizationFixture();
  const subscription = SubscriptionFixture({
    organization,
    plan: 'am3_business',
    onDemandPeriodStart: '2021-05-02',
    onDemandPeriodEnd: '2021-06-01',
  });
  const usageData = CustomerUsageFixture();

  beforeEach(() => {
    jest.restoreAllMocks();
    organization.features = ['seer-billing'];
    organization.access = ['org:billing'];
    SubscriptionStore.set(organization.slug, subscription);
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/history/current/`,
      method: 'GET',
      body: BillingHistoryFixture(),
    });
  });

  it('renders actions for billing users', async () => {
    render(
      <UsageOverview
        subscription={subscription}
        organization={organization}
        usageData={usageData}
      />,
      {additionalWrapper: SecondaryNavigationContextProvider}
    );

    await screen.findByRole('heading', {name: 'Usage: May 2 - Jun 1, 2021'});
    expect(screen.getByRole('button', {name: 'View all usage'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Download as CSV'})).toBeInTheDocument();
  });

  it('does not render actions for non-billing users', async () => {
    organization.access = [];
    render(
      <UsageOverview
        subscription={subscription}
        organization={organization}
        usageData={usageData}
      />,
      {additionalWrapper: SecondaryNavigationContextProvider}
    );

    await screen.findByRole('heading', {name: 'Usage: May 2 - Jun 1, 2021'});
    expect(
      screen.queryByRole('button', {name: 'View all usage'})
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', {name: 'Download as CSV'})
    ).not.toBeInTheDocument();
  });

  it('opens panel based with no query params', async () => {
    jest
      .spyOn(useMedia, 'useMedia')
      .mockImplementation(query => query.includes('min-width'));
    render(
      <UsageOverview
        subscription={subscription}
        organization={organization}
        usageData={usageData}
      />,
      {additionalWrapper: SecondaryNavigationContextProvider}
    );

    await screen.findByRole('heading', {name: 'Errors'});
  });

  it('opens panel based on query params', async () => {
    jest
      .spyOn(useMedia, 'useMedia')
      .mockImplementation(query => query.includes('min-width'));
    render(
      <UsageOverview
        subscription={subscription}
        organization={organization}
        usageData={usageData}
      />,
      {
        additionalWrapper: SecondaryNavigationContextProvider,
        initialRouterConfig: {
          location: {
            pathname: '/organizations/org-slug/subscription/usage-overview',
            query: {product: DataCategory.REPLAYS},
          },
        },
      }
    );

    await screen.findByRole('heading', {name: 'Replays'});
    expect(screen.queryByRole('heading', {name: 'Errors'})).not.toBeInTheDocument();
  });

  it('defaults to last selected when query param is invalid', async () => {
    jest
      .spyOn(useMedia, 'useMedia')
      .mockImplementation(query => query.includes('min-width'));
    render(
      <UsageOverview
        subscription={subscription}
        organization={organization}
        usageData={usageData}
      />,
      {
        additionalWrapper: SecondaryNavigationContextProvider,
        initialRouterConfig: {
          location: {
            pathname: '/organizations/org-slug/subscription/usage-overview',
            query: {product: 'transactions'},
          },
        },
      }
    );

    await screen.findByRole('heading', {name: 'Errors'});
    expect(screen.queryByRole('heading', {name: 'Transactions'})).not.toBeInTheDocument();
  });

  it('selects gifted-only product from URL query parameter', async () => {
    jest
      .spyOn(useMedia, 'useMedia')
      .mockImplementation(query => query.includes('min-width'));
    const originalMonitorSeats = subscription.categories.monitorSeats;
    subscription.categories.monitorSeats = {
      ...subscription.categories.monitorSeats!,
      reserved: 0,
      free: 1,
      prepaid: 1,
    };
    render(
      <UsageOverview
        subscription={subscription}
        organization={organization}
        usageData={usageData}
      />,
      {
        additionalWrapper: SecondaryNavigationContextProvider,
        initialRouterConfig: {
          location: {
            pathname: '/organizations/org-slug/subscription/usage-overview',
            query: {product: DataCategory.MONITOR_SEATS},
          },
        },
      }
    );

    await screen.findByRole('heading', {name: 'Cron Monitors'});
    expect(screen.queryByRole('heading', {name: 'Errors'})).not.toBeInTheDocument();
    subscription.categories.monitorSeats = originalMonitorSeats;
  });

  it('does not select product from URL when no quota at all', async () => {
    jest
      .spyOn(useMedia, 'useMedia')
      .mockImplementation(query => query.includes('min-width'));
    const originalMonitorSeats = subscription.categories.monitorSeats;
    subscription.categories.monitorSeats = {
      ...subscription.categories.monitorSeats!,
      reserved: 0,
      free: 0,
      prepaid: 0,
    };
    render(
      <UsageOverview
        subscription={subscription}
        organization={organization}
        usageData={usageData}
      />,
      {
        additionalWrapper: SecondaryNavigationContextProvider,
        initialRouterConfig: {
          location: {
            pathname: '/organizations/org-slug/subscription/usage-overview',
            query: {product: DataCategory.MONITOR_SEATS},
          },
        },
      }
    );

    await screen.findByRole('heading', {name: 'Errors'});
    expect(
      screen.queryByRole('heading', {name: 'Cron Monitors'})
    ).not.toBeInTheDocument();
    subscription.categories.monitorSeats = originalMonitorSeats;
  });

  it('selects product with softCapType from URL query parameter', async () => {
    jest
      .spyOn(useMedia, 'useMedia')
      .mockImplementation(query => query.includes('min-width'));
    const originalMonitorSeats = subscription.categories.monitorSeats;
    const originalHasSoftCap = subscription.hasSoftCap;
    subscription.categories.monitorSeats = {
      ...subscription.categories.monitorSeats!,
      reserved: 0,
      free: 0,
      prepaid: 0,
      softCapType: 'TRUE_FORWARD',
    };
    subscription.hasSoftCap = true;
    render(
      <UsageOverview
        subscription={subscription}
        organization={organization}
        usageData={usageData}
      />,
      {
        additionalWrapper: SecondaryNavigationContextProvider,
        initialRouterConfig: {
          location: {
            pathname: '/organizations/org-slug/subscription/usage-overview',
            query: {product: DataCategory.MONITOR_SEATS},
          },
        },
      }
    );

    await screen.findByRole('heading', {name: 'Cron Monitors'});
    expect(screen.queryByRole('heading', {name: 'Errors'})).not.toBeInTheDocument();
    subscription.categories.monitorSeats = originalMonitorSeats;
    subscription.hasSoftCap = originalHasSoftCap;
  });

  it('selects product from URL when subscription has hasSoftCap=true and category has null softCapType', async () => {
    jest
      .spyOn(useMedia, 'useMedia')
      .mockImplementation(query => query.includes('min-width'));
    const originalMonitorSeats = subscription.categories.monitorSeats;
    const originalHasSoftCap = subscription.hasSoftCap;
    subscription.hasSoftCap = true;
    subscription.categories.monitorSeats = {
      ...subscription.categories.monitorSeats!,
      reserved: 0,
      free: 0,
      prepaid: 0,
      softCapType: null,
    };
    render(
      <UsageOverview
        subscription={subscription}
        organization={organization}
        usageData={usageData}
      />,
      {
        additionalWrapper: SecondaryNavigationContextProvider,
        initialRouterConfig: {
          location: {
            pathname: '/organizations/org-slug/subscription/usage-overview',
            query: {product: DataCategory.MONITOR_SEATS},
          },
        },
      }
    );

    await screen.findByRole('heading', {name: 'Cron Monitors'});
    expect(screen.queryByRole('heading', {name: 'Errors'})).not.toBeInTheDocument();
    subscription.categories.monitorSeats = originalMonitorSeats;
    subscription.hasSoftCap = originalHasSoftCap;
  });

  it('selects product from URL when category has unlimited prepaid (UNLIMITED_RESERVED sentinel)', async () => {
    jest
      .spyOn(useMedia, 'useMedia')
      .mockImplementation(query => query.includes('min-width'));
    const originalMonitorSeats = subscription.categories.monitorSeats;
    subscription.categories.monitorSeats = {
      ...subscription.categories.monitorSeats!,
      reserved: UNLIMITED_RESERVED,
      free: 0,
      prepaid: UNLIMITED_RESERVED,
      softCapType: null,
    };
    render(
      <UsageOverview
        subscription={subscription}
        organization={organization}
        usageData={usageData}
      />,
      {
        additionalWrapper: SecondaryNavigationContextProvider,
        initialRouterConfig: {
          location: {
            pathname: '/organizations/org-slug/subscription/usage-overview',
            query: {product: DataCategory.MONITOR_SEATS},
          },
        },
      }
    );

    await screen.findByRole('heading', {name: 'Cron Monitors'});
    expect(screen.queryByRole('heading', {name: 'Errors'})).not.toBeInTheDocument();
    subscription.categories.monitorSeats = originalMonitorSeats;
  });

  it('can switch panel by clicking table rows', async () => {
    jest
      .spyOn(useMedia, 'useMedia')
      .mockImplementation(query => query.includes('min-width'));
    render(
      <UsageOverview
        subscription={subscription}
        organization={organization}
        usageData={usageData}
      />,
      {additionalWrapper: SecondaryNavigationContextProvider}
    );

    await screen.findByRole('heading', {name: 'Errors'});
    expect(screen.queryByRole('heading', {name: 'Replays'})).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name: 'View Replays usage'}));
    await screen.findByRole('heading', {name: 'Replays'});
    expect(screen.queryByRole('heading', {name: 'Errors'})).not.toBeInTheDocument();
  });
});
