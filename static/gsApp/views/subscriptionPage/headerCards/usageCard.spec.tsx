import {OrganizationFixture} from 'sentry-fixture/organization';

import {MetricHistoryFixture} from 'getsentry-test/fixtures/metricHistory';
import {
  SubscriptionFixture,
  SubscriptionWithLegacySeerFixture,
} from 'getsentry-test/fixtures/subscription';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import {DataCategory} from 'sentry/types/core';

import {OnDemandBudgetMode} from 'getsentry/types';

import {UsageCard} from './usageCard';

describe('UsageCard', () => {
  const organization = OrganizationFixture({features: ['ondemand-budgets']});

  it('should render amount used and max available', () => {
    const subscription = SubscriptionFixture({
      organization,
      planTier: 'am2',
      plan: 'am2_team',
    });

    subscription.planDetails.categories = [DataCategory.ERRORS];

    const prepaid = 100_000;
    subscription.planDetails.planCategories = {
      errors: [{events: prepaid, price: 1500, unitPrice: 0.015, onDemandPrice: 0.02}],
    };

    subscription.categories.errors = MetricHistoryFixture({
      prepaid,
      reserved: prepaid,
      usage: 0, // 0% usage
      free: 0,
      onDemandQuantity: 0,
      onDemandSpendUsed: 0,
    });

    render(<UsageCard organization={organization} subscription={subscription} />);

    expect(screen.getByText('Included in Subscription').parentElement).toHaveTextContent(
      '0% of $15'
    );
    expect(screen.getByTestId('current-monthly-spend')).toHaveTextContent('$44');
  });

  it('should render on demand max spend and prepaid', () => {
    const subscription = SubscriptionFixture({
      organization,
      planTier: 'am2',
      plan: 'am2_team',
      onDemandMaxSpend: 1000,
    });

    subscription.planDetails.categories = [DataCategory.ERRORS];

    const prepaid = 100_000;
    subscription.planDetails.planCategories = {
      errors: [{events: prepaid, price: 1500, unitPrice: 0.015, onDemandPrice: 0.02}],
    };

    subscription.categories.errors = MetricHistoryFixture({
      prepaid,
      reserved: prepaid,
      usage: 0, // 0% usage
      free: 0,
      onDemandQuantity: 0,
      onDemandSpendUsed: 0,
    });

    render(<UsageCard organization={organization} subscription={subscription} />);

    expect(screen.getByText('Included in Subscription').parentElement).toHaveTextContent(
      '0% of $15'
    );
    expect(screen.getByText('On-Demand').parentElement).toHaveTextContent('$0 of $10');
    expect(screen.getByText('On-Demand Spent')).toBeInTheDocument();
    expect(screen.getByTestId('current-monthly-spend')).toHaveTextContent('$44');
  });

  it('should render PAYG spend for am3', () => {
    const subscription = SubscriptionFixture({
      organization,
      planTier: 'am3',
      plan: 'am3_team',
      onDemandMaxSpend: 1000,
      onDemandBudgets: {
        budgetMode: OnDemandBudgetMode.SHARED,
        enabled: true,
        sharedMaxBudget: 1000,
        onDemandSpendUsed: 0,
      },
    });
    render(<UsageCard organization={organization} subscription={subscription} />);

    expect(screen.getByText('Pay-as-you-go Spent')).toBeInTheDocument();
    expect(screen.getByTestId('current-monthly-spend')).toHaveTextContent('$29');
  });

  it('should not render prepaid usage if org has no reserved spend', () => {
    const subscription = SubscriptionFixture({
      organization,
      planTier: 'am2',
      plan: 'am2_business_auf',
      onDemandMaxSpend: 1000,
    });

    render(<UsageCard organization={organization} subscription={subscription} />);

    expect(screen.queryByText('Reserved')).not.toBeInTheDocument();
    expect(screen.getByText('On-Demand')).toBeInTheDocument();
    expect(screen.queryByText('Included In Subscription')).not.toBeInTheDocument();
    expect(screen.getByTestId('current-monthly-spend')).toHaveTextContent('$0');
  });

  it('should not render anything for orgs with no spend', () => {
    const subscription = SubscriptionFixture({
      organization,
      planTier: 'am2',
      plan: 'am2_team',
    });

    const {container} = render(
      <UsageCard organization={organization} subscription={subscription} />
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('should not render anything for free orgs', () => {
    const subscription = SubscriptionFixture({
      organization,
      planTier: 'am2',
      plan: 'am2_f',
    });

    const {container} = render(
      <UsageCard organization={organization} subscription={subscription} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('should not show reserved budget under included in subscription', () => {
    const seerSubscription = SubscriptionWithLegacySeerFixture({
      organization,
      plan: 'am3_business',
    });

    render(<UsageCard organization={organization} subscription={seerSubscription} />);

    expect(screen.queryByText('Reserved')).not.toBeInTheDocument();
    expect(screen.queryByText('Included In Subscription')).not.toBeInTheDocument();
    // $89 business plan + $20 for reserved budget
    expect(screen.getByTestId('current-monthly-spend')).toHaveTextContent('$109');
  });

  it('should not calculate prepaid spend with reserved budget', () => {
    const seerSubscription = SubscriptionWithLegacySeerFixture({
      organization,
      plan: 'am3_business',
    });
    const errorsPrice = 1000;
    seerSubscription.planDetails.planCategories.errors = [
      {events: 100_000, price: errorsPrice, unitPrice: 0.1, onDemandPrice: 0.2},
    ];
    seerSubscription.categories.errors!.reserved = 100_000;

    render(<UsageCard organization={organization} subscription={seerSubscription} />);

    expect(screen.queryByText('Reserved')).not.toBeInTheDocument();
    expect(screen.getByText('Included in Subscription').parentElement).toHaveTextContent(
      '0% of $10'
    );
    // $89 business plan + $20 for reserved budget + $10 for errors
    expect(screen.getByTestId('current-monthly-spend')).toHaveTextContent('$119');
  });
});
