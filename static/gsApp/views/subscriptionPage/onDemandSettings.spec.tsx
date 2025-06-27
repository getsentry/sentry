import {OrganizationFixture} from 'sentry-fixture/organization';

import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {
  fireEvent,
  render,
  renderGlobalModal,
  screen,
  userEvent,
} from 'sentry-test/reactTestingLibrary';

import SubscriptionStore from 'getsentry/stores/subscriptionStore';
import {OnDemandBudgetMode, PlanTier, type Subscription} from 'getsentry/types';

import {OnDemandSettings} from './onDemandSettings';

describe('edit on-demand budget', () => {
  const organization = OrganizationFixture({
    features: ['ondemand-budgets'],
  });
  const onDemandOrg = OrganizationFixture({
    features: ['ondemand-budgets'],
    access: ['org:billing'],
  });

  beforeEach(() => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/monitor-count/`,
      method: 'GET',
      body: {enabledMonitorCount: 0, disabledMonitorCount: 0},
    });
  });

  it('allows VC partner accounts to edit on-demand budget without payment source', function () {
    const subscription = SubscriptionFixture({
      plan: 'am3_business',
      planTier: PlanTier.AM3,
      isFree: false,
      isTrial: false,
      supportsOnDemand: true,
      organization: onDemandOrg,
      paymentSource: null,
      partner: {
        externalId: 'x123x',
        name: 'VC Org',
        partnership: {
          id: 'VC',
          displayName: 'VC',
          supportNote: '',
        },
        isActive: true,
      },
      onDemandBudgets: {
        enabled: true,
        budgetMode: OnDemandBudgetMode.SHARED,
        sharedMaxBudget: 4500,
        onDemandSpendUsed: 0,
      },
    });
    SubscriptionStore.set(onDemandOrg.slug, subscription);

    render(<OnDemandSettings organization={organization} subscription={subscription} />, {
      organization: onDemandOrg,
    });

    // Should show Edit button even without payment source
    expect(screen.getByText('Edit')).toBeInTheDocument();
    expect(screen.getByText('Pay-as-you-go Budget')).toBeInTheDocument();
    expect(screen.getByText('$45')).toBeInTheDocument();
  });

  it('requires payment source for non-VC accounts', function () {
    const subscription = SubscriptionFixture({
      plan: 'am3_business',
      planTier: PlanTier.AM3,
      isFree: false,
      isTrial: false,
      supportsOnDemand: true,
      organization: onDemandOrg,
      paymentSource: null,
      onDemandBudgets: {
        enabled: true,
        budgetMode: OnDemandBudgetMode.SHARED,
        sharedMaxBudget: 4500,
        onDemandSpendUsed: 0,
      },
    });
    SubscriptionStore.set(onDemandOrg.slug, subscription);

    render(<OnDemandSettings organization={organization} subscription={subscription} />, {
      organization: onDemandOrg,
    });

    // Should show Add Credit Card message
    expect(screen.getByText('Add Credit Card')).toBeInTheDocument();
    expect(
      screen.getByText(
        "To set a pay-as-you-go budget, you'll need a valid credit card on file."
      )
    ).toBeInTheDocument();
  });

  it('switch from shared budget to per-category budget', async function () {
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/ondemand-budgets/`,
      method: 'POST',
      statusCode: 200,
      body: {
        enabled: true,
        budgetMode: OnDemandBudgetMode.PER_CATEGORY,
        errorsBudget: 1000,
        transactionsBudget: 2000,
        attachmentsBudget: 3000,
        budgets: {errors: 1000, transactions: 2000, attachments: 3000},
      },
    });

    const subscription = SubscriptionFixture({
      plan: 'am1_business',
      planTier: PlanTier.AM1,
      isFree: false,
      isTrial: false,
      supportsOnDemand: true,
      organization: onDemandOrg,
      onDemandBudgets: {
        enabled: true,
        budgetMode: OnDemandBudgetMode.SHARED,
        sharedMaxBudget: 4500,
        onDemandSpendUsed: 0,
      },
    });
    SubscriptionStore.set(onDemandOrg.slug, subscription);

    MockApiClient.addMockResponse({
      url: `/subscriptions/${onDemandOrg.slug}/`,
      method: 'GET',
      statusCode: 200,
      body: {
        ...subscription,
        onDemandMaxSpend: 1000 + 2000 + 3000,
        onDemandSpendUsed: 100 + 200 + 300,
        onDemandBudgets: {
          enabled: true,
          budgetMode: OnDemandBudgetMode.PER_CATEGORY,
          errorsBudget: 1000,
          transactionsBudget: 2000,
          attachmentsBudget: 3000,
          budgets: {
            errors: 1000,
            transactions: 2000,
            attachments: 3000,
            monitorSeats: 4000,
          },
          errorSpendUsed: 100,
          transactionSpendUsed: 200,
          attachmentSpendUsed: 300,
          usedSpends: {
            errors: 100,
            transactions: 200,
            attachments: 300,
            monitorSeats: 400,
          },
        },
      },
    });

    const {rerender} = render(
      <OnDemandSettings organization={organization} subscription={subscription} />,
      {
        organization: onDemandOrg,
      }
    );
    const {waitForModalToHide} = renderGlobalModal();

    expect(await screen.findByTestId('shared-budget-info')).toBeInTheDocument();
    expect(screen.getByText('$45')).toBeInTheDocument();

    await userEvent.click(screen.getByText('Edit'));

    expect(await screen.findByText('Edit On-Demand Budgets')).toBeInTheDocument();
    expect(screen.getByTestId('shared-budget-radio')).toBeChecked();
    expect(screen.getByRole('textbox', {name: 'Shared max budget'})).toHaveValue('45');

    // Select per-category budget strategy
    await userEvent.click(screen.getByTestId('per-category-budget-radio'));
    expect(screen.getByTestId('per-category-budget-radio')).toBeChecked();
    expect(screen.getByTestId('shared-budget-radio')).not.toBeChecked();
    expect(
      screen.queryByRole('textbox', {name: 'Shared max budget'})
    ).not.toBeInTheDocument();

    // Shared budget should split 50:50 between transactions and errors (whole dollars, remainder added to errors)
    expect(screen.getByRole('textbox', {name: 'Errors budget'})).toHaveValue('23');
    expect(screen.getByRole('textbox', {name: 'Transactions budget'})).toHaveValue('22');
    expect(screen.getByRole('textbox', {name: 'Attachments budget'})).toHaveValue('0');
    expect(screen.getByRole('textbox', {name: 'Cron monitors budget'})).toHaveValue('0');

    fireEvent.change(screen.getByRole('textbox', {name: 'Errors budget'}), {
      target: {value: '10'},
    });
    fireEvent.change(screen.getByRole('textbox', {name: 'Transactions budget'}), {
      target: {value: '20'},
    });
    fireEvent.change(screen.getByRole('textbox', {name: 'Attachments budget'}), {
      target: {value: '30'},
    });
    fireEvent.change(screen.getByRole('textbox', {name: 'Cron monitors budget'}), {
      target: {value: '40'},
    });
    await userEvent.click(screen.getByLabelText('Save'));
    await waitForModalToHide();

    const updatedSubscription = await new Promise<Subscription>(resolve => {
      SubscriptionStore.get(organization.slug, resolve);
    });
    expect(updatedSubscription.onDemandMaxSpend).toBe(1000 + 2000 + 3000);
    rerender(
      <OnDemandSettings organization={organization} subscription={updatedSubscription} />
    );

    expect(await screen.findByText('$10')).toBeInTheDocument();
    expect(screen.getByText('$20')).toBeInTheDocument();
    expect(screen.getByText('$30')).toBeInTheDocument();
    expect(screen.getByText('$40')).toBeInTheDocument();
    expect(screen.getByTestId('per-category-budget-info')).toBeInTheDocument();
  });

  it('switch from shared budget to per-category budget with sub-$1.00 budget', async function () {
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/ondemand-budgets/`,
      method: 'POST',
      statusCode: 200,
      body: {
        enabled: true,
        budgetMode: OnDemandBudgetMode.PER_CATEGORY,
        errorsBudget: 100,
        transactionsBudget: 0,
        attachmentsBudget: 3000,
        budgets: {
          errors: 100,
          transactions: 0,
          attachments: 2400,
          replays: 300,
          monitorSeats: 200,
        },
      },
    });

    const subscription = SubscriptionFixture({
      plan: 'am1_business',
      planTier: PlanTier.AM1,
      isFree: false,
      isTrial: false,
      supportsOnDemand: true,
      organization: onDemandOrg,
      onDemandBudgets: {
        enabled: true,
        budgetMode: OnDemandBudgetMode.SHARED,
        sharedMaxBudget: 76,
        onDemandSpendUsed: 0,
      },
    });
    SubscriptionStore.set(onDemandOrg.slug, subscription);

    MockApiClient.addMockResponse({
      url: `/subscriptions/${onDemandOrg.slug}/`,
      method: 'GET',
      statusCode: 200,
      body: {
        ...subscription,
        onDemandMaxSpend: 100 + 3000,
        onDemandSpendUsed: 76,
        onDemandBudgets: {
          enabled: true,
          budgetMode: OnDemandBudgetMode.PER_CATEGORY,
          errorsBudget: 100,
          transactionsBudget: 0,
          attachmentsBudget: 3000,
          budgets: {
            errors: 100,
            transactions: 0,
            attachments: 2400,
            replays: 300,
            monitorSeats: 200,
          },
          errorSpendUsed: 76,
          transactionSpendUsed: 0,
          attachmentSpendUsed: 0,
          usedSpends: {
            errors: 76,
            transactions: 0,
            attachments: 0,
            replays: 0,
            monitorSeats: 100,
          },
        },
      },
    });

    const {rerender} = render(
      <OnDemandSettings organization={organization} subscription={subscription} />,
      {
        organization: onDemandOrg,
      }
    );
    const {waitForModalToHide} = renderGlobalModal();

    expect(await screen.findByTestId('shared-budget-info')).toBeInTheDocument();
    expect(screen.getByText('$0.76')).toBeInTheDocument();

    await userEvent.click(screen.getByText('Edit'));

    expect(await screen.findByText('Edit On-Demand Budgets')).toBeInTheDocument();
    expect(screen.getByTestId('shared-budget-radio')).toBeChecked();
    expect(screen.getByRole('textbox', {name: 'Shared max budget'})).toHaveValue('0.76');

    // Select per-category budget strategy
    await userEvent.click(screen.getByTestId('per-category-budget-radio'));
    expect(screen.getByTestId('per-category-budget-radio')).toBeChecked();
    expect(screen.getByTestId('shared-budget-radio')).not.toBeChecked();
    expect(
      screen.queryByRole('textbox', {name: 'Shared max budget'})
    ).not.toBeInTheDocument();

    // Shared budget should split 50:50 between transactions and errors (whole dollars, remainder added to errors)
    expect(screen.getByRole('textbox', {name: 'Errors budget'})).toHaveValue('1');
    expect(screen.getByRole('textbox', {name: 'Transactions budget'})).toHaveValue('0');
    expect(screen.getByRole('textbox', {name: 'Attachments budget'})).toHaveValue('0');
    expect(screen.getByRole('textbox', {name: 'Cron monitors budget'})).toHaveValue('0');

    fireEvent.change(screen.getByRole('textbox', {name: 'Attachments budget'}), {
      target: {value: '30'},
    });
    await userEvent.click(screen.getByLabelText('Save'));
    await waitForModalToHide();

    const updatedSubscription = await new Promise<Subscription>(resolve => {
      SubscriptionStore.get(onDemandOrg.slug, resolve);
    });
    expect(updatedSubscription.onDemandMaxSpend).toBe(3100);
    rerender(
      <OnDemandSettings organization={organization} subscription={updatedSubscription} />
    );

    expect(await screen.findByText('$3')).toBeInTheDocument();
    expect(screen.getByText('$24')).toBeInTheDocument();
    expect(screen.getByText('$2')).toBeInTheDocument();
    expect(screen.getByTestId('per-category-budget-info')).toBeInTheDocument();
  });

  it('switch from per-category budget to shared budget', async function () {
    MockApiClient.addMockResponse({
      url: `/customers/${onDemandOrg.slug}/ondemand-budgets/`,
      method: 'POST',
      statusCode: 200,
      body: {
        enabled: true,
        budgetMode: OnDemandBudgetMode.SHARED,
        sharedMaxBudget: 4200,
      },
    });

    const subscription = SubscriptionFixture({
      plan: 'am1_business',
      planTier: PlanTier.AM1,
      isFree: false,
      isTrial: false,
      supportsOnDemand: true,
      organization: onDemandOrg,
      onDemandBudgets: {
        enabled: true,
        budgetMode: OnDemandBudgetMode.PER_CATEGORY,
        errorsBudget: 1000,
        transactionsBudget: 2000,
        attachmentsBudget: 3000,
        replaysBudget: 0,
        budgets: {
          errors: 1000,
          transactions: 2000,
          attachments: 3000,
          replays: 0,
          monitorSeats: 5000,
        },
        attachmentSpendUsed: 0,
        errorSpendUsed: 0,
        transactionSpendUsed: 0,
        usedSpends: {},
      },
    });
    SubscriptionStore.set(onDemandOrg.slug, subscription);

    MockApiClient.addMockResponse({
      url: `/subscriptions/${onDemandOrg.slug}/`,
      method: 'GET',
      statusCode: 200,
      body: {
        ...subscription,
        onDemandMaxSpend: 4200,
        onDemandSpendUsed: 2022,
        onDemandBudgets: {
          enabled: true,
          budgetMode: OnDemandBudgetMode.SHARED,
          sharedMaxBudget: 4200,
          onDemandSpendUsed: 2022,
        },
      },
    });

    const {rerender} = render(
      <OnDemandSettings organization={organization} subscription={subscription} />,
      {
        organization: onDemandOrg,
      }
    );
    const {waitForModalToHide} = renderGlobalModal();

    expect(await screen.findByTestId('per-category-budget-info')).toBeInTheDocument();
    expect(screen.getByText('$10')).toBeInTheDocument();
    expect(screen.getByText('$20')).toBeInTheDocument();
    expect(screen.getByText('$30')).toBeInTheDocument();

    await userEvent.click(screen.getByText('Edit'));

    expect(await screen.findByText('Edit On-Demand Budgets')).toBeInTheDocument();
    expect(screen.getByTestId('per-category-budget-radio')).toBeChecked();
    expect(screen.getByRole('textbox', {name: 'Errors budget'})).toHaveValue('10');
    expect(screen.getByRole('textbox', {name: 'Transactions budget'})).toHaveValue('20');
    expect(screen.getByRole('textbox', {name: 'Attachments budget'})).toHaveValue('30');
    expect(screen.getByRole('textbox', {name: 'Cron monitors budget'})).toHaveValue('50');

    // Select shared budget strategy
    await userEvent.click(screen.getByTestId('shared-budget-radio'));
    expect(screen.getByTestId('shared-budget-radio')).toBeChecked();
    expect(screen.getByTestId('per-category-budget-radio')).not.toBeChecked();
    expect(
      screen.queryByRole('textbox', {name: 'Errors budget'})
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('textbox', {name: 'Transactions budget'})
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('textbox', {name: 'Attachments budget'})
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('textbox', {name: 'Cron Monitors budget'})
    ).not.toBeInTheDocument();

    // Default shared budget should be total of the current per-category budget.
    expect(screen.getByRole('textbox', {name: 'Shared max budget'})).toHaveValue('110');

    fireEvent.change(screen.getByRole('textbox', {name: 'Shared max budget'}), {
      target: {value: '42'},
    });

    await userEvent.click(screen.getByLabelText('Save'));
    await waitForModalToHide();

    const updatedSubscription = await new Promise<Subscription>(resolve => {
      SubscriptionStore.get(onDemandOrg.slug, resolve);
    });
    expect(updatedSubscription.onDemandMaxSpend).toBe(4200);
    rerender(
      <OnDemandSettings organization={organization} subscription={updatedSubscription} />
    );

    expect(await screen.findByText('$42')).toBeInTheDocument();
    expect(screen.getByTestId('shared-budget-info')).toBeInTheDocument();
  });

  it('disable shared on-demand budget', async function () {
    MockApiClient.addMockResponse({
      url: `/customers/${onDemandOrg.slug}/ondemand-budgets/`,
      method: 'POST',
      statusCode: 200,
      body: {
        enabled: false,
        budgetMode: OnDemandBudgetMode.SHARED,
        sharedMaxBudget: 0,
      },
    });

    const subscription = SubscriptionFixture({
      plan: 'am1_business',
      planTier: PlanTier.AM1,
      isFree: false,
      isTrial: false,
      supportsOnDemand: true,
      organization: onDemandOrg,
      onDemandBudgets: {
        enabled: true,
        budgetMode: OnDemandBudgetMode.SHARED,
        sharedMaxBudget: 4200,
        onDemandSpendUsed: 0,
      },
    });
    SubscriptionStore.set(onDemandOrg.slug, subscription);

    MockApiClient.addMockResponse({
      url: `/subscriptions/${onDemandOrg.slug}/`,
      method: 'GET',
      statusCode: 200,
      body: {
        ...subscription,
        onDemandMaxSpend: 0,
        onDemandSpendUsed: 0,
        onDemandBudgets: {
          enabled: false,
          budgetMode: OnDemandBudgetMode.SHARED,
          sharedMaxBudget: 0,
          onDemandSpendUsed: 0,
        },
      },
    });

    const {rerender} = render(
      <OnDemandSettings organization={organization} subscription={subscription} />,
      {
        organization: onDemandOrg,
      }
    );
    const {waitForModalToHide} = renderGlobalModal();

    expect(await screen.findByTestId('shared-budget-info')).toBeInTheDocument();
    expect(screen.getByText('$42')).toBeInTheDocument();

    await userEvent.click(screen.getByText('Edit'));

    expect(await screen.findByText('Edit On-Demand Budgets')).toBeInTheDocument();
    expect(screen.getByTestId('shared-budget-radio')).toBeChecked();
    expect(screen.getByRole('textbox', {name: 'Shared max budget'})).toHaveValue('42');

    // Disable on-demand budgets
    fireEvent.change(screen.getByRole('textbox', {name: 'Shared max budget'}), {
      target: {value: '0'},
    });
    await userEvent.click(screen.getByLabelText('Save'));
    await waitForModalToHide();

    const updatedSubscription = await new Promise<Subscription>(resolve => {
      SubscriptionStore.get(onDemandOrg.slug, resolve);
    });
    expect(updatedSubscription.onDemandMaxSpend).toBe(0);
    rerender(
      <OnDemandSettings organization={organization} subscription={updatedSubscription} />
    );

    expect(await screen.findByText('Set Up On-Demand')).toBeInTheDocument();
    expect(screen.queryByTestId('per-category-budget-info')).not.toBeInTheDocument();
    expect(screen.queryByTestId('shared-budget-info')).not.toBeInTheDocument();
  });

  it('disable per-category on-demand budget', async function () {
    MockApiClient.addMockResponse({
      url: `/customers/${onDemandOrg.slug}/ondemand-budgets/`,
      method: 'POST',
      statusCode: 200,
      body: {
        enabled: false,
        budgetMode: OnDemandBudgetMode.SHARED,
        sharedMaxBudget: 0,
      },
    });

    const subscription = SubscriptionFixture({
      plan: 'am1_business',
      planTier: PlanTier.AM1,
      isFree: false,
      isTrial: false,
      supportsOnDemand: true,
      organization: onDemandOrg,
      onDemandBudgets: {
        enabled: true,
        budgetMode: OnDemandBudgetMode.PER_CATEGORY,
        errorsBudget: 1000,
        transactionsBudget: 2000,
        attachmentsBudget: 3000,
        replaysBudget: 0,
        budgets: {
          errors: 1000,
          transactions: 2000,
          attachments: 3000,
          replays: 0,
          monitorSeats: 5000,
        },
        attachmentSpendUsed: 0,
        errorSpendUsed: 0,
        transactionSpendUsed: 0,
        usedSpends: {},
      },
    });
    SubscriptionStore.set(onDemandOrg.slug, subscription);

    MockApiClient.addMockResponse({
      url: `/subscriptions/${onDemandOrg.slug}/`,
      method: 'GET',
      statusCode: 200,
      body: {
        ...subscription,
        onDemandMaxSpend: 0,
        onDemandSpendUsed: 0,
        onDemandBudgets: {
          enabled: false,
          budgetMode: OnDemandBudgetMode.SHARED,
          sharedMaxBudget: 0,
          onDemandSpendUsed: 0,
        },
      },
    });

    const {rerender} = render(
      <OnDemandSettings organization={organization} subscription={subscription} />,
      {
        organization: onDemandOrg,
      }
    );
    const {waitForModalToHide} = renderGlobalModal();

    expect(await screen.findByTestId('per-category-budget-info')).toBeInTheDocument();
    expect(screen.getByText('$10')).toBeInTheDocument();
    expect(screen.getByText('$20')).toBeInTheDocument();
    expect(screen.getByText('$30')).toBeInTheDocument();

    await userEvent.click(screen.getByText('Edit'));

    expect(await screen.findByText('Edit On-Demand Budgets')).toBeInTheDocument();
    expect(screen.getByTestId('per-category-budget-radio')).toBeChecked();
    expect(screen.getByRole('textbox', {name: 'Errors budget'})).toHaveValue('10');
    expect(screen.getByRole('textbox', {name: 'Transactions budget'})).toHaveValue('20');
    expect(screen.getByRole('textbox', {name: 'Attachments budget'})).toHaveValue('30');
    expect(screen.getByRole('textbox', {name: 'Cron monitors budget'})).toHaveValue('50');

    // Disable on-demand budgets
    fireEvent.change(screen.getByRole('textbox', {name: 'Errors budget'}), {
      target: {value: '0'},
    });
    fireEvent.change(screen.getByRole('textbox', {name: 'Transactions budget'}), {
      target: {value: '0'},
    });
    fireEvent.change(screen.getByRole('textbox', {name: 'Attachments budget'}), {
      target: {value: '0'},
    });
    fireEvent.change(screen.getByRole('textbox', {name: 'Cron monitors budget'}), {
      target: {value: '0'},
    });

    await userEvent.click(screen.getByLabelText('Save'));
    await waitForModalToHide();

    const updatedSubscription = await new Promise<Subscription>(resolve => {
      SubscriptionStore.get(onDemandOrg.slug, resolve);
    });
    expect(updatedSubscription.onDemandMaxSpend).toBe(0);
    rerender(
      <OnDemandSettings organization={organization} subscription={updatedSubscription} />
    );

    expect(await screen.findByText('Set Up On-Demand')).toBeInTheDocument();
    expect(screen.queryByTestId('per-category-budget-info')).not.toBeInTheDocument();
    expect(screen.queryByTestId('shared-budget-info')).not.toBeInTheDocument();
  });
});
