import {OrganizationFixture} from 'sentry-fixture/organization';

import {MetricHistoryFixture} from 'getsentry-test/fixtures/metricHistory';
import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {render, screen} from 'sentry-test/reactTestingLibrary';

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
    const prepaid = 100_000;
    subscription.categories.errors = MetricHistoryFixture({
      prepaid,
      reserved: prepaid,
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
    const prepaid = 100_000;
    subscription.categories.errors = MetricHistoryFixture({
      prepaid,
      reserved: prepaid,
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
    expect(screen.getByTestId('current-monthly-spend')).toHaveTextContent('$960');
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
});
