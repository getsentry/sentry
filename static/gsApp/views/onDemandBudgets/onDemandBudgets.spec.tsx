import {OrganizationFixture} from 'sentry-fixture/organization';

import {PlanDetailsLookupFixture} from 'getsentry-test/fixtures/planDetailsLookup';
import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {
  fireEvent,
  render,
  renderGlobalModal,
  screen,
  userEvent,
} from 'sentry-test/reactTestingLibrary';

import SubscriptionStore from 'getsentry/stores/subscriptionStore';
import type {Subscription as TSubscription} from 'getsentry/types';
import {AddOnCategory, OnDemandBudgetMode, PlanTier} from 'getsentry/types';
import OnDemandBudgets from 'getsentry/views/onDemandBudgets';
import OnDemandBudgetEdit from 'getsentry/views/onDemandBudgets/onDemandBudgetEdit';

describe('OnDemandBudgets', () => {
  const organization = OrganizationFixture({access: ['org:billing']});

  const getComponent = (
    props: Omit<React.ComponentProps<typeof OnDemandBudgets>, 'organization'>
  ) => <OnDemandBudgets organization={organization} {...props} />;

  const createWrapper = (
    props: Omit<React.ComponentProps<typeof OnDemandBudgets>, 'organization'>
  ) => render(getComponent(props));

  const defaultProps = {
    organization,
    onDemandEnabled: true,
    onDemandSupported: true,
    currentBudgetMode: OnDemandBudgetMode.SHARED,
    setBudgetMode: jest.fn(),
    setOnDemandBudget: jest.fn(),
  };

  beforeEach(() => {
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

  it('renders on-demand not supported state', () => {
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

  it('renders credit card modal on the on-demand setting for account without a credit card', async () => {
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
        `To set on-demand budgets, you'll need a valid credit card on file.`
      )
    ).toBeInTheDocument();
    expect(screen.getByText('Add Credit Card')).toBeInTheDocument();

    await userEvent.click(screen.getByTestId('add-cc-card'));
    expect(await screen.findByText('Stripe')).toBeInTheDocument();
  });

  it('renders initial on-demand budget setup state', () => {
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

  it('renders shared on-demand budget', () => {
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

  it('renders per-category budget', () => {
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
        budgets: {
          errors: 1000,
          transactions: 2000,
          attachments: 3000,
          replays: 0,
          monitorSeats: 0,
        },
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

  it('initialize shared budget', async () => {
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

  it('initialize per-category budget', async () => {
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/ondemand-budgets/`,
      method: 'POST',
      statusCode: 200,
      body: {
        enabled: true,
        budgetMode: OnDemandBudgetMode.PER_CATEGORY,
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
          budgets: {
            errors: 1000,
            transactions: 2000,
            attachments: 3000,
            monitorSeats: 4000,
          },
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

  it('renders pay-as-you-go instead of on-demand for am3', async () => {
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

    expect(
      screen.getByText(
        `This budget ensures continued monitoring after you've used up your reserved event volume. We'll only charge you for actual usage, so this is your maximum charge for overage.`
      )
    ).toBeInTheDocument();

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

  it('renders billed through partner for self serve partner', async () => {
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
      isSelfServePartner: true,
      partner: {
        externalId: 'x123x',
        name: 'FOO',
        partnership: {
          id: 'foo',
          displayName: 'FOO',
          supportNote: '',
        },
        isActive: true,
      },
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
    createWrapper(props);
    renderGlobalModal();

    await userEvent.click(screen.getByRole('button', {name: 'Set Up Pay-as-you-go'}));
    expect(
      screen.getByText(
        `This budget ensures continued monitoring after you've used up your reserved event volume. We'll only charge you for actual usage, so this is your maximum charge for overage. This will be part of your FOO bill.`
      )
    ).toBeInTheDocument();
  });

  it('displays original Seer warning copy by default in per-category section', () => {
    organization.features = ['seer-billing'];
    const subscription = SubscriptionFixture({
      plan: 'am1_business',
      planTier: PlanTier.AM1,
      isFree: false,
      isTrial: false,
      supportsOnDemand: true,
      planDetails: {
        ...PlanDetailsLookupFixture('am1_business')!,
      },
      organization,
      onDemandBudgets: {
        enabled: true,
        budgetMode: OnDemandBudgetMode.PER_CATEGORY,
        budgets: {
          errors: 1000,
          transactions: 2000,
          attachments: 3000,
          monitorSeats: 4000,
        },
        usedSpends: {},
      },
    });
    // set legacy Seer add-on as unavailable so we don't include warning for both types of Seer
    subscription.addOns = {
      ...subscription.addOns,
      [AddOnCategory.LEGACY_SEER]: {
        ...subscription.addOns?.[AddOnCategory.LEGACY_SEER]!,
        isAvailable: false,
      },
    };

    const activePlan = subscription.planDetails;

    const onDemandBudget = {
      budgetMode: OnDemandBudgetMode.PER_CATEGORY as const,
      budgets: {
        errors: 1000,
        transactions: 2000,
        attachments: 3000,
        monitorSeats: 4000,
      },
    };

    render(
      <OnDemandBudgetEdit
        {...defaultProps}
        subscription={subscription}
        activePlan={activePlan}
        onDemandBudget={onDemandBudget}
      />
    );

    expect(screen.getByTestId('shared-budget-radio')).toBeInTheDocument();
    expect(screen.getByTestId('per-category-budget-radio')).toBeInTheDocument();

    expect(screen.getByTestId('per-category-budget-radio')).toBeChecked();
    expect(screen.getByTestId('shared-budget-radio')).not.toBeChecked();

    expect(
      screen.getByText(
        'Additional Seer usage is only available through a shared on-demand budget. To enable on-demand usage switch to a shared on-demand budget.'
      )
    ).toBeInTheDocument();
  });

  it('displays per-category warning for multiple categories', () => {
    const subscription = SubscriptionFixture({
      plan: 'am2_business',
      planTier: PlanTier.AM2,
      isFree: false,
      isTrial: false,
      supportsOnDemand: true,
      planDetails: {
        ...PlanDetailsLookupFixture('am2_business')!,
      },
      organization,
      onDemandBudgets: {
        enabled: true,
        budgetMode: OnDemandBudgetMode.PER_CATEGORY,
        budgets: {
          errors: 1000,
          transactions: 2000,
          attachments: 3000,
          monitorSeats: 4000,
        },
        usedSpends: {},
      },
    });
    // set legacy Seer add-on as unavailable so we don't include warning for both types of Seer
    subscription.addOns = {
      ...subscription.addOns,
      [AddOnCategory.LEGACY_SEER]: {
        ...subscription.addOns?.[AddOnCategory.LEGACY_SEER]!,
        isAvailable: false,
      },
    };

    const activePlan = subscription.planDetails;

    const onDemandBudget = {
      budgetMode: OnDemandBudgetMode.PER_CATEGORY as const,
      budgets: {
        errors: 1000,
        transactions: 2000,
        attachments: 3000,
        monitorSeats: 4000,
      },
    };

    render(
      <OnDemandBudgetEdit
        {...defaultProps}
        subscription={subscription}
        activePlan={activePlan}
        onDemandBudget={onDemandBudget}
      />
    );

    expect(screen.getByTestId('per-category-budget-radio')).toBeInTheDocument();
    expect(screen.getByTestId('per-category-budget-radio')).toBeChecked();

    expect(
      screen.getByText(
        'Additional logs and Seer usage are only available through a shared on-demand budget. To enable on-demand usage switch to a shared on-demand budget.'
      )
    ).toBeInTheDocument();
  });

  it('displays does not display contact support for education sponsored', () => {
    const subscription = SubscriptionFixture({
      plan: 'am3_sponsored_team_auf',
      planTier: PlanTier.AM3,
      sponsoredType: 'education',
      isFree: false,
      isTrial: false,
      supportsOnDemand: true,
      planDetails: {
        ...PlanDetailsLookupFixture('am3_team_auf')!,
      },
      organization,
      onDemandBudgets: {
        enabled: false,
        budgetMode: OnDemandBudgetMode.SHARED,
        sharedMaxBudget: 0,
        onDemandSpendUsed: 0,
      },
    });

    render(
      <OnDemandBudgets
        {...defaultProps}
        subscription={subscription}
        organization={organization}
        onDemandEnabled={false}
        hasPaymentSource={false}
      />
    );

    expect(screen.queryByText('Contact Support')).not.toBeInTheDocument();
  });
});
