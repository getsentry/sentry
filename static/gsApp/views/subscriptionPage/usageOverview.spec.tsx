import moment from 'moment-timezone';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {BillingHistoryFixture} from 'getsentry-test/fixtures/billingHistory';
import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {render, screen} from 'sentry-test/reactTestingLibrary';
import {resetMockDate, setMockDate} from 'sentry-test/utils';

import {DataCategory} from 'sentry/types/core';

import SubscriptionStore from 'getsentry/stores/subscriptionStore';
import UsageOverview from 'getsentry/views/subscriptionPage/usageOverview';

describe('UsageOverview', () => {
  const organization = OrganizationFixture();
  const subscription = SubscriptionFixture({organization, plan: 'am3_business'});

  beforeEach(() => {
    setMockDate(new Date('2021-05-07'));
    MockApiClient.clearMockResponses();
    organization.access = ['org:billing'];
    SubscriptionStore.set(organization.slug, subscription);
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/history/`,
      method: 'GET',
      body: BillingHistoryFixture(),
    });
  });

  afterEach(() => {
    resetMockDate();
  });

  it('renders columns and buttons for billing users', () => {
    render(<UsageOverview subscription={subscription} organization={organization} />);
    expect(screen.getByRole('columnheader', {name: 'Product'})).toBeInTheDocument();
    expect(screen.getByRole('columnheader', {name: 'Current usage'})).toBeInTheDocument();
    expect(
      screen.getByRole('columnheader', {name: 'Reserved usage'})
    ).toBeInTheDocument();
    expect(
      screen.getByRole('columnheader', {name: 'Reserved spend'})
    ).toBeInTheDocument();
    expect(
      screen.getByRole('columnheader', {name: 'Pay-as-you-go spend'})
    ).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'View usage history'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Download as CSV'})).toBeInTheDocument();
  });

  it('renders columns for non-billing users', () => {
    organization.access = [];
    render(<UsageOverview subscription={subscription} organization={organization} />);
    expect(screen.getByRole('columnheader', {name: 'Product'})).toBeInTheDocument();
    expect(screen.getByRole('columnheader', {name: 'Current usage'})).toBeInTheDocument();
    expect(
      screen.getByRole('columnheader', {name: 'Reserved usage'})
    ).toBeInTheDocument();
    expect(screen.queryByText('Reserved spend')).not.toBeInTheDocument();
    expect(screen.queryByText('Pay-as-you-go spend')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', {name: 'View usage history'})
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', {name: 'Download as CSV'})
    ).not.toBeInTheDocument();
  });

  it('renders table based on subscription state', () => {
    subscription.onDemandMaxSpend = 100_00;
    subscription.productTrials = [
      {
        category: DataCategory.PROFILE_DURATION,
        isStarted: false,
        reasonCode: 1001,
        startDate: undefined,
        endDate: moment().utc().add(20, 'years').format(),
      },
      {
        category: DataCategory.REPLAYS,
        isStarted: true,
        reasonCode: 1001,
        startDate: moment().utc().subtract(10, 'days').format(),
        endDate: moment().utc().add(20, 'days').format(),
      },
    ];
    subscription.categories.errors = {
      ...subscription.categories.errors!,
      free: 1000,
      usage: 6000,
      onDemandSpendUsed: 10_00,
    };
    subscription.categories.spans = {
      ...subscription.categories.spans!,
      reserved: 20_000_000,
    };

    render(<UsageOverview subscription={subscription} organization={organization} />);

    // Continuous profile hours product trial available
    expect(
      screen.getByRole('button', {
        name: 'Start 14 day free Continuous Profile Hours trial',
      })
    ).toBeInTheDocument();
    expect(screen.getByText('Trial available')).toBeInTheDocument();

    // Replays product trial active
    expect(screen.getByText('20 days left')).toBeInTheDocument();

    // Errors usage and gifted units
    expect(screen.getByText('6,000 / 51,000')).toBeInTheDocument();
    expect(screen.getByText('$10.00')).toBeInTheDocument();

    // Reserved spans above platform volume
    expect(screen.getByText('0 / 20,000,000')).toBeInTheDocument();
    expect(screen.getByText('$32.00')).toBeInTheDocument();
  });
});
