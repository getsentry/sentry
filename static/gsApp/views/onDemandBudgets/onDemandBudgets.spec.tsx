import {OrganizationFixture} from 'sentry-fixture/organization';

import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {
  fireEvent,
  render,
  renderGlobalModal,
  screen,
  userEvent,
} from 'sentry-test/reactTestingLibrary';

import ModalStore from 'sentry/stores/modalStore';

import SubscriptionStore from 'getsentry/stores/subscriptionStore';
import type {Subscription as TSubscription} from 'getsentry/types';
import {OnDemandBudgetMode, PlanTier} from 'getsentry/types';
import OnDemandBudgets from 'getsentry/views/onDemandBudgets';

describe('OnDemandBudgets', () => {
  const organization = OrganizationFixture();

  const getComponent = (
    props: Omit<React.ComponentProps<typeof OnDemandBudgets>, 'organization'>
  ) => <OnDemandBudgets organization={organization} {...props} />;

  const createWrapper = (
    props: Omit<React.ComponentProps<typeof OnDemandBudgets>, 'organization'>
  ) => render(getComponent(props));

  beforeEach(function () {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/payments/setup/`,
      method: 'POST',
      statusCode: 200,
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/monitor-count/`,
      method: 'GET',
      body: {enabledMonitorCount: 0, disabledMonitorCount: 0},
    });

    SubscriptionStore.set(organization.slug, {});
  });

  it('renders on-demand not supported state', function () {
    const subscription = SubscriptionFixture({
      plan: 'am1_business',
      planTier: PlanTier.AM1,
      isFree: false,
      isTrial: false,
      supportsOnDemand: true,
      organization,
      onDemandBudgets: {
        enabled: false,
        budgetMode: OnDemandBudgetMode.SHARED,
        sharedMaxBudget: 0,
        onDemandSpendUsed: 0,
      },
    });
    SubscriptionStore.set(organization.slug, subscription);

    createWrapper({
      subscription,
      onDemandEnabled: false,
      hasPaymentSource: true,
    });

    expect(
      screen.getByText('On-Demand is not supported for your account.')
    ).toBeInTheDocument();
    expect(screen.getByText('Contact Support')).toBeInTheDocument();
  });

  it('renders credit card modal on the on-demand setting for account without a credit card', async function () {
    const subscription = SubscriptionFixture({
      plan: 'am1_business',
      planTier: PlanTier.AM1,
      isFree: false,
      isTrial: false,
      supportsOnDemand: true,
      organization,
      onDemandBudgets: {
        enabled: false,
        budgetMode: OnDemandBudgetMode.SHARED,
        sharedMaxBudget: 0,
        onDemandSpendUsed: 0,
      },
    });
    SubscriptionStore.set(organization.slug, subscription);

    createWrapper({
      subscription,
      onDemandEnabled: true,
      hasPaymentSource: false,
    });
    renderGlobalModal();

    expect(
      screen.getByText(
        `To use on-demand budgets, you'll need a valid credit card on file.`
      )
    ).toBeInTheDocument();
    expect(screen.getByText('Add Credit Card')).toBeInTheDocument();

    await userEvent.click(screen.getByTestId('add-cc-card'));
    expect(await screen.findByText('Stripe')).toBeInTheDocument();

    ModalStore.reset();
  });

  it('allows VC partner accounts to set up on-demand budget without credit card', function () {
    const subscription = SubscriptionFixture({
      plan: 'am3_business',
      planTier: PlanTier.AM3,
      isFree: false,
      isTrial: false,
      supportsOnDemand: true,
      organization,
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
        enabled: false,
        budgetMode: OnDemandBudgetMode.SHARED,
        sharedMaxBudget: 0,
        onDemandSpendUsed: 0,
      },
    });
    SubscriptionStore.set(organization.slug, subscription);

    const isVCPartner = subscription.partner?.partnership?.id === 'VC';
    createWrapper({
      subscription,
      onDemandEnabled: true,
      hasPaymentSource: isVCPartner,
    });

    // Should show Set Up Pay-as-you-go button instead of Add Credit Card
    expect(screen.getByText('Set Up Pay-as-you-go')).toBeInTheDocument();
    expect(screen.queryByText('Add Credit Card')).not.toBeInTheDocument();
  });

  it('renders initial on-demand budget setup state', function () {
    const subscription = SubscriptionFixture({
      plan: 'am1_business',
      planTier: PlanTier.AM1,
      isFree: false,
      isTrial: false,
      supportsOnDemand: true,
      organization,
      onDemandBudgets: {
        enabled: false,
        budgetMode: OnDemandBudgetMode.SHARED,
        sharedMaxBudget: 0,
        onDemandSpendUsed: 0,
      },
    });
    SubscriptionStore.set(organization.slug, subscription);

    createWrapper({
      subscription,
      onDemandEnabled: true,
      hasPaymentSource: true,
    });

    expect(screen.getByText('Set Up On-Demand')).toBeInTheDocument();
  });

  it('renders shared on-demand budget', function () {
    const subscription = SubscriptionFixture({
      plan: 'am1_business',
      planTier: PlanTier.AM1,
      isFree: false,
      isTrial: false,
      supportsOnDemand: true,
      organization,
      onDemandBudgets: {
        enabled: true,
        budgetMode: OnDemandBudgetMode.SHARED,
        sharedMaxBudget: 4200,
        onDemandSpendUsed: 0,
      },
    });
    SubscriptionStore.set(organization.slug, subscription);

    createWrapper({
      subscription,
      onDemandEnabled: true,
      hasPaymentSource: true,
    });

    expect(screen.getByText('Shared Budget')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Your on-demand budget is shared among all categories on a first come, first serve basis. There are no restrictions for any single category consuming the entire budget.'
      )
    ).toBeInTheDocument();
    expect(screen.getByText('$42')).toBeInTheDocument();
  });

  it('renders per-category budget', function () {
    const subscription = SubscriptionFixture({
      plan: 'am1_business',
      planTier: PlanTier.AM1,
      isFree: false,
      isTrial: false,
      supportsOnDemand: true,
      organization,
      onDemandBudgets: {
        enabled: true,
        budgetMode: OnDemandBudgetMode.PER_CATEGORY,
        errorsBudget: 1000,
        transactionsBudget: 2000,
        attachmentsBudget: 3000,
        replaysBudget: 0,
        monitorSeatsBudget: 0,
        budgets: {
          errors: 1000,
          transactions: 2000,
          attachments: 3000,
          replays: 0,
          monitorSeats: 0,
        },
        attachmentSpendUsed: 0,
        errorSpendUsed: 0,
        transactionSpendUsed: 0,
        usedSpends: {},
      },
    });
    SubscriptionStore.set(organization.slug, subscription);

    createWrapper({
      subscription,
      onDemandEnabled: true,
      hasPaymentSource: true,
    });

    expect(
      screen.getByText(
        'You have dedicated on-demand budget for errors, transactions, replays, attachments, cron monitors, and uptime monitors.'
      )
    ).toBeInTheDocument();
    expect(screen.getByText('$10')).toBeInTheDocument();
    expect(screen.getByText('$20')).toBeInTheDocument();
    expect(screen.getByText('$30')).toBeInTheDocument();
  });

  it('initialize shared budget', async function () {
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/ondemand-budgets/`,
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
      organization,
      onDemandBudgets: {
        enabled: false,
        budgetMode: OnDemandBudgetMode.SHARED,
        sharedMaxBudget: 0,
        onDemandSpendUsed: 0,
      },
    });
    SubscriptionStore.set(organization.slug, subscription);

    MockApiClient.addMockResponse({
      url: `/subscriptions/${organization.slug}/`,
      method: 'GET',
      statusCode: 200,
      body: {
        ...subscription,
        onDemandMaxSpend: 4200,
        onDemandSpendUsed: 100,
        onDemandBudgets: {
          enabled: true,
          budgetMode: OnDemandBudgetMode.SHARED,
          sharedMaxBudget: 4200,
          onDemandSpendUsed: 100,
        },
      },
    });

    const props = {
      subscription,
      onDemandEnabled: true,
      hasPaymentSource: true,
    };
    const {rerender} = createWrapper(props);
    const {waitForModalToHide} = renderGlobalModal();

    await userEvent.click(screen.getByText('Set Up On-Demand'));

    expect(await screen.findByText('Save')).toBeInTheDocument();
    expect(screen.getByTestId('shared-budget-radio')).toBeChecked();
    expect(screen.getByRole('textbox', {name: 'Shared max budget'})).toHaveValue('0');

    fireEvent.change(screen.getByRole('textbox', {name: 'Shared max budget'}), {
      target: {value: '42'},
    });
    await userEvent.click(screen.getByLabelText('Save'));
    await waitForModalToHide();

    const updatedSubscription = await new Promise<TSubscription>(resolve => {
      SubscriptionStore.get(organization.slug, resolve);
    });
    expect(updatedSubscription.onDemandMaxSpend).toBe(4200);
    expect(updatedSubscription.onDemandSpendUsed).toBe(100);
    rerender(getComponent({...props, subscription: updatedSubscription}));

    expect(await screen.findByText('$42')).toBeInTheDocument();
    expect(screen.getByTestId('shared-budget-info')).toBeInTheDocument();
  });

  it('initialize per-category budget', async function () {
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
      organization,
      onDemandBudgets: {
        enabled: false,
        budgetMode: OnDemandBudgetMode.SHARED,
        sharedMaxBudget: 0,
        onDemandSpendUsed: 0,
      },
    });
    SubscriptionStore.set(organization.slug, subscription);

    MockApiClient.addMockResponse({
      url: `/subscriptions/${organization.slug}/`,
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

    const props = {
      subscription,
      onDemandEnabled: true,
      hasPaymentSource: true,
    };
    const {rerender} = createWrapper(props);
    const {waitForModalToHide} = renderGlobalModal();

    await userEvent.click(screen.getByText('Set Up On-Demand'));

    expect(await screen.findByText('Save')).toBeInTheDocument();
    expect(screen.getByTestId('shared-budget-radio')).toBeChecked();
    expect(screen.getByRole('textbox', {name: 'Shared max budget'})).toHaveValue('0');

    // Select per-category budget strategy
    await userEvent.click(screen.getByTestId('per-category-budget-radio'));
    expect(screen.getByTestId('per-category-budget-radio')).toBeChecked();
    expect(screen.getByTestId('shared-budget-radio')).not.toBeChecked();
    expect(
      screen.queryByRole('textbox', {name: 'Shared max budget'})
    ).not.toBeInTheDocument();

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

    const updatedSubscription = await new Promise<TSubscription>(resolve => {
      SubscriptionStore.get(organization.slug, resolve);
    });
    expect(updatedSubscription.onDemandMaxSpend).toBe(1000 + 2000 + 3000);
    rerender(getComponent({...props, subscription: updatedSubscription}));

    expect(await screen.findByText('$10')).toBeInTheDocument();
    expect(screen.getByText('$20')).toBeInTheDocument();
    expect(screen.getByText('$30')).toBeInTheDocument();
    expect(screen.getByText('$40')).toBeInTheDocument();
    expect(screen.getByTestId('per-category-budget-info')).toBeInTheDocument();
  });

  it('renders pay-as-you-go instead of on-demand for am3', async function () {
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/ondemand-budgets/`,
      method: 'POST',
      statusCode: 200,
      body: {
        enabled: true,
        budgetMode: OnDemandBudgetMode.SHARED,
        sharedMaxBudget: 4200,
      },
    });

    const subscription = SubscriptionFixture({
      plan: 'am3_business',
      planTier: PlanTier.AM3,
      isFree: false,
      isTrial: false,
      supportsOnDemand: true,
      organization,
      onDemandBudgets: {
        enabled: false,
        budgetMode: OnDemandBudgetMode.SHARED,
        sharedMaxBudget: 0,
        onDemandSpendUsed: 0,
      },
    });
    SubscriptionStore.set(organization.slug, subscription);

    MockApiClient.addMockResponse({
      url: `/subscriptions/${organization.slug}/`,
      method: 'GET',
      statusCode: 200,
      body: {
        ...subscription,
        onDemandMaxSpend: 4200,
        onDemandSpendUsed: 100,
        onDemandBudgets: {
          enabled: true,
          budgetMode: OnDemandBudgetMode.SHARED,
          sharedMaxBudget: 4200,
          onDemandSpendUsed: 100,
        },
      },
    });

    const props = {
      subscription,
      onDemandEnabled: true,
      hasPaymentSource: true,
    };
    const {rerender} = createWrapper(props);
    const {waitForModalToHide} = renderGlobalModal();

    await userEvent.click(screen.getByRole('button', {name: 'Set Up Pay-as-you-go'}));

    expect(await screen.findByText('Save')).toBeInTheDocument();
    const budgetTextbox = screen.getByRole('textbox', {name: 'Pay-as-you-go max budget'});
    expect(budgetTextbox).toHaveValue('0');

    await userEvent.type(budgetTextbox, '42');
    await userEvent.click(screen.getByLabelText('Save'));
    await waitForModalToHide();

    const updatedSubscription = await new Promise<TSubscription>(resolve => {
      SubscriptionStore.get(organization.slug, resolve);
    });
    expect(updatedSubscription.onDemandMaxSpend).toBe(4200);
    expect(updatedSubscription.onDemandSpendUsed).toBe(100);
    rerender(getComponent({...props, subscription: updatedSubscription}));

    expect(await screen.findByText('$42')).toBeInTheDocument();
    expect(screen.getByTestId('shared-budget-info')).toBeInTheDocument();
  });
});
