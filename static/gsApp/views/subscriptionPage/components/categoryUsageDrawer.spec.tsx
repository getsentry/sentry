import {OrganizationFixture} from 'sentry-fixture/organization';

import {BillingStatFixture} from 'getsentry-test/fixtures/billingStat';
import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {UsageTotalFixture} from 'getsentry-test/fixtures/usageTotal';
import {act, render, screen} from 'sentry-test/reactTestingLibrary';

import {DataCategory} from 'sentry/types/core';
import {OrganizationContext} from 'sentry/views/organizationContext';

import SubscriptionStore from 'getsentry/stores/subscriptionStore';
import {PlanTier} from 'getsentry/types';

import CategoryUsageDrawer from './categoryUsageDrawer';

describe('CategoryUsageDrawer', () => {
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
    organization.features.push('subscriptions-v3');
  });

  function renderComponent(props: any) {
    return render(
      <OrganizationContext value={organization}>
        <CategoryUsageDrawer {...props} />
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
    await act(async () => {
      renderComponent({
        subscription,
        categoryInfo: subscription.categories.errors,
        eventTotals: {[DataCategory.ERRORS]: totals},
        totals,
        stats,
        periodEnd: '2021-02-01',
        periodStart: '2021-01-01',
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
    await act(async () => {
      renderComponent({
        subscription,
        categoryInfo: subscription.categories.transactions,
        eventTotals: {
          [DataCategory.TRANSACTIONS]: totals,
          [DataCategory.PROFILES]: totals,
        },
        totals,
        stats,
        periodEnd: '2021-02-01',
        periodStart: '2021-01-01',
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
