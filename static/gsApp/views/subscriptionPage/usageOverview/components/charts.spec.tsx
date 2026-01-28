import {OrganizationFixture} from 'sentry-fixture/organization';

import {BillingStatFixture} from 'getsentry-test/fixtures/billingStat';
import {CustomerUsageFixture} from 'getsentry-test/fixtures/customerUsage';
import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {UsageTotalFixture} from 'getsentry-test/fixtures/usageTotal';
import {act, render, screen} from 'sentry-test/reactTestingLibrary';

import {DataCategory} from 'sentry/types/core';
import {OrganizationContext} from 'sentry/views/organizationContext';

import SubscriptionStore from 'getsentry/stores/subscriptionStore';
import {PlanTier} from 'getsentry/types';
import UsageCharts from 'getsentry/views/subscriptionPage/usageOverview/components/charts';
import type {BreakdownPanelProps} from 'getsentry/views/subscriptionPage/usageOverview/types';

describe('UsageCharts', () => {
  const organization = OrganizationFixture();
  const totals = UsageTotalFixture({
    accepted: 50,
    dropped: 10,
    droppedOverQuota: 5,
    droppedSpikeProtection: 2,
    droppedOther: 3,
  });
  const stats = [BillingStatFixture()];

  beforeEach(() => {
    organization.features = [];
  });

  function renderComponent(props: Omit<BreakdownPanelProps, 'organization'>) {
    return render(
      <OrganizationContext value={organization}>
        <UsageCharts {...props} organization={organization} />
      </OrganizationContext>
    );
  }

  it('renders', async () => {
    const subscription = SubscriptionFixture({
      organization,
    });
    subscription.categories.errors = {
      ...subscription.categories.errors!,
      usage: 50,
    };
    SubscriptionStore.set(organization.slug, subscription);
    const usageData = CustomerUsageFixture({
      totals: {
        [DataCategory.ERRORS]: totals,
      },
      stats: {
        [DataCategory.ERRORS]: stats,
      },
    });
    await act(async () => {
      renderComponent({
        subscription,
        usageData,
        selectedProduct: DataCategory.ERRORS,
      });

      // filter values are asynchronously persisted
      await tick();
    });

    expect(screen.getByText('Current Usage Period')).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Total ingested'})).toBeInTheDocument();
    expect(screen.getByRole('row', {name: 'Accepted 50 83%'})).toBeInTheDocument();
    expect(screen.getByRole('row', {name: 'Total Dropped 10 17%'})).toBeInTheDocument();
    expect(screen.getByRole('row', {name: 'Over Quota 5 8%'})).toBeInTheDocument();
    expect(screen.getByRole('row', {name: 'Spike Protection 2 3%'})).toBeInTheDocument();
    expect(screen.getByRole('row', {name: 'Other 3 5%'})).toBeInTheDocument();
  });

  it('renders event breakdown', async () => {
    const subscription = SubscriptionFixture({
      organization,
      plan: 'am2_team',
      planTier: PlanTier.AM2,
    });
    organization.features.push('profiling-billing');
    subscription.categories.transactions = {
      ...subscription.categories.transactions!,
      usage: 50,
    };
    SubscriptionStore.set(organization.slug, subscription);
    const usageData = CustomerUsageFixture({
      totals: {
        [DataCategory.TRANSACTIONS]: totals,
        [DataCategory.PROFILES]: totals,
      },
      stats: {
        [DataCategory.TRANSACTIONS]: stats,
        [DataCategory.PROFILES]: stats,
      },
      eventTotals: {
        [DataCategory.TRANSACTIONS]: {
          [DataCategory.TRANSACTIONS]: totals,
          [DataCategory.PROFILES]: totals,
        },
      },
    });
    await act(async () => {
      renderComponent({
        subscription,
        selectedProduct: DataCategory.TRANSACTIONS,
        usageData,
      });
      await tick();
    });

    // only event breakdown tables should have a header for the first column
    expect(
      screen.queryByRole('columnheader', {name: 'Performance Units'})
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('columnheader', {name: 'Performance Unit Events'})
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('columnheader', {name: 'Transaction Events'})
    ).toBeInTheDocument();
    expect(
      screen.getByRole('columnheader', {name: 'Profile Events'})
    ).toBeInTheDocument();

    expect(
      screen.getByRole('columnheader', {name: '% of Performance Units'})
    ).toBeInTheDocument();
    expect(
      screen.getByRole('columnheader', {name: '% of Transactions'})
    ).toBeInTheDocument();
    expect(screen.getByRole('columnheader', {name: '% of Profiles'})).toBeInTheDocument();
  });
});
