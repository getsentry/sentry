import {OrganizationFixture} from 'sentry-fixture/organization';

import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
} from 'sentry-test/reactTestingLibrary';
import {resetMockDate, setMockDate} from 'sentry-test/utils';

import {OnDemandBudgetMode} from 'getsentry/types';
import PaygCard from 'getsentry/views/subscriptionPage/headerCards/paygCard';

describe('PaygCard', () => {
  const organization = OrganizationFixture({
    features: ['subscriptions-v3'],
    access: ['org:billing'],
  });

  beforeEach(() => {
    setMockDate(new Date('2022-06-09'));
  });

  afterEach(() => {
    resetMockDate();
  });

  it('renders for plan with no budget modes', async () => {
    const subscription = SubscriptionFixture({
      organization,
      plan: 'am3_team',
      onDemandBudgets: {
        budgetMode: OnDemandBudgetMode.SHARED,
        sharedMaxBudget: 10_00,
        enabled: true,
        onDemandSpendUsed: 2_51,
      },
    });
    render(<PaygCard organization={organization} subscription={subscription} />);

    expect(screen.getByRole('heading', {name: 'Pay-as-you-go'})).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', {name: 'Edit pay-as-you-go limit'})
    ).not.toBeInTheDocument();
    expect(screen.getByText('$10 limit')).toBeInTheDocument();
    expect(screen.getByText('$2.51')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Edit limit'}));
    expect(
      screen.getByRole('heading', {name: 'Edit pay-as-you-go limit'})
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', {name: 'Pay-as-you-go limit'})
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('spinbutton', {name: 'Edit pay-as-you-go limit'})
    ).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'PAYG pricing'})).toBeInTheDocument();
  });

  it('renders for plan with budget modes', async () => {
    const subscription = SubscriptionFixture({
      organization,
      plan: 'am2_business',
      onDemandBudgets: {
        budgetMode: OnDemandBudgetMode.SHARED,
        sharedMaxBudget: 0,
        enabled: true,
        onDemandSpendUsed: 0,
      },
    });
    render(<PaygCard organization={organization} subscription={subscription} />);

    expect(screen.getByRole('heading', {name: 'On-Demand'})).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', {name: 'Edit on-demand limit'})
    ).not.toBeInTheDocument();
    expect(screen.getByText('$0 limit')).toBeInTheDocument();
    expect(screen.getByText('$0')).toBeInTheDocument();

    renderGlobalModal();
    await userEvent.click(screen.getByRole('button', {name: 'Set limit'}));
    await screen.findByRole('heading', {name: 'Set your on-demand limit'});
    expect(screen.queryByRole('button', {name: /pricing/})).not.toBeInTheDocument();
  });

  it('renders per-category budget total', () => {
    const subscription = SubscriptionFixture({
      organization,
      plan: 'am2_business',
      onDemandBudgets: {
        budgetMode: OnDemandBudgetMode.PER_CATEGORY,
        enabled: true,
        budgets: {
          errors: 1_00,
          replays: 2_00,
          attachments: 3_00,
        },
        usedSpends: {
          errors: 50,
          attachments: 3_00,
        },
      },
    });
    render(<PaygCard organization={organization} subscription={subscription} />);
    expect(screen.getByText('$6 limit (combined total)')).toBeInTheDocument();
    expect(screen.getByText('$3.50')).toBeInTheDocument();
  });

  it('can update using inline input', async () => {
    MockApiClient.addMockResponse({
      url: `/subscriptions/${organization.slug}/`,
      method: 'GET',
    });
    const mockApiCall = MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/ondemand-budgets/`,
      method: 'POST',
      statusCode: 200,
    });
    const subscription = SubscriptionFixture({
      organization,
      plan: 'am3_team',
    });
    render(<PaygCard organization={organization} subscription={subscription} />);

    expect(screen.getByRole('heading', {name: 'Pay-as-you-go'})).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name: 'Set limit'}));
    expect(
      screen.queryByRole('heading', {name: 'Pay-as-you-go'})
    ).not.toBeInTheDocument();
    await userEvent.type(
      screen.getByRole('spinbutton', {name: 'Edit pay-as-you-go limit'}),
      '100'
    );
    await userEvent.click(screen.getByRole('button', {name: 'Save'}));
    expect(mockApiCall).toHaveBeenCalledWith(
      `/customers/${organization.slug}/ondemand-budgets/`,
      expect.objectContaining({
        method: 'POST',
        data: {
          budgetMode: OnDemandBudgetMode.SHARED,
          sharedMaxBudget: 100_00,
        },
      })
    );

    // closes inline edit
    expect(screen.getByRole('heading', {name: 'Pay-as-you-go'})).toBeInTheDocument();
  });
});
