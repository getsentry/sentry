import {OrganizationFixture} from 'sentry-fixture/organization';

import {BillingHistoryFixture} from 'getsentry-test/fixtures/billingHistory';
import {CustomerUsageFixture} from 'getsentry-test/fixtures/customerUsage';
import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {DataCategory} from 'sentry/types/core';
import * as useMedia from 'sentry/utils/useMedia';

import SubscriptionStore from 'getsentry/stores/subscriptionStore';
import UsageOverview from 'getsentry/views/subscriptionPage/usageOverview';

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
    organization.features = ['subscriptions-v3', 'seer-billing'];
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
      />
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
      />
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
      .spyOn(useMedia, 'default')
      .mockImplementation(query => query.includes('min-width'));
    render(
      <UsageOverview
        subscription={subscription}
        organization={organization}
        usageData={usageData}
      />
    );

    await screen.findByRole('heading', {name: 'Errors'});
  });

  it('opens panel based on query params', async () => {
    jest
      .spyOn(useMedia, 'default')
      .mockImplementation(query => query.includes('min-width'));
    render(
      <UsageOverview
        subscription={subscription}
        organization={organization}
        usageData={usageData}
      />,
      {
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
      .spyOn(useMedia, 'default')
      .mockImplementation(query => query.includes('min-width'));
    render(
      <UsageOverview
        subscription={subscription}
        organization={organization}
        usageData={usageData}
      />,
      {
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

  it('can switch panel by clicking table rows', async () => {
    jest
      .spyOn(useMedia, 'default')
      .mockImplementation(query => query.includes('min-width'));
    render(
      <UsageOverview
        subscription={subscription}
        organization={organization}
        usageData={usageData}
      />
    );

    await screen.findByRole('heading', {name: 'Errors'});
    expect(screen.queryByRole('heading', {name: 'Replays'})).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name: 'View Replays usage'}));
    await screen.findByRole('heading', {name: 'Replays'});
    expect(screen.queryByRole('heading', {name: 'Errors'})).not.toBeInTheDocument();
  });
});
