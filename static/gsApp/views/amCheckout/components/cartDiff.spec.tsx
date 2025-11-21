import {OrganizationFixture} from 'sentry-fixture/organization';

import {PlanDetailsLookupFixture} from 'getsentry-test/fixtures/planDetailsLookup';
import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import {
  AddOnCategory,
  OnDemandBudgetMode,
  type Plan,
  type Subscription,
} from 'getsentry/types';
import CartDiff from 'getsentry/views/amCheckout/components/cartDiff';
import {type CheckoutFormData} from 'getsentry/views/amCheckout/types';

describe('CartDiff', () => {
  const bizPlan = PlanDetailsLookupFixture('am3_business')!;
  const teamAnnualPlan = PlanDetailsLookupFixture('am3_team_auf')!;
  const org = OrganizationFixture();
  const sub = SubscriptionFixture({
    organization: org,
    plan: teamAnnualPlan.id,
    isFree: false,
  });
  const defaultFormData: CheckoutFormData = {
    plan: teamAnnualPlan.id,
    reserved: {
      ...Object.fromEntries(
        Object.entries(sub.categories)
          .filter(([_, history]) => history.reserved)
          .map(([category, history]) => [category, history.reserved])
      ),
    },
  };

  function renderCartDiff({
    activePlan = teamAnnualPlan,
    formData,
    subscription = sub,
  }: {
    formData: CheckoutFormData;
    activePlan?: Plan;
    subscription?: Subscription;
  }) {
    render(
      <CartDiff
        activePlan={activePlan}
        formData={formData}
        subscription={subscription}
        isOpen
        onToggle={() => {}}
        organization={org}
      />
    );
  }

  it('renders for returning customers with changes', async () => {
    const formData: CheckoutFormData = {
      ...defaultFormData,
      plan: bizPlan.id,
      reserved: {
        ...defaultFormData.reserved,
        errors: 100_000,
      },
      onDemandBudget: {
        budgetMode: OnDemandBudgetMode.SHARED,
        sharedMaxBudget: 100_00,
      },
      addOns: {
        [AddOnCategory.LEGACY_SEER]: {
          enabled: true,
        },
      },
    };

    renderCartDiff({formData, activePlan: bizPlan});

    expect(await screen.findByText('Changes')).toBeInTheDocument();
    const planDiff = await screen.findByTestId('plan-diff');
    const reservedDiff = await screen.findByTestId('reserved-diff');
    const paygDiff = await screen.findByTestId('shared-spend-limit-diff');
    expect(screen.queryByTestId('per-category-spend-limit-diff')).not.toBeInTheDocument();

    expect(planDiff).toHaveTextContent('Plan');
    expect(planDiff).toHaveTextContent('TeamBusiness');
    expect(planDiff).toHaveTextContent('YearlyMonthly');
    expect(planDiff).toHaveTextContent('Seer');

    expect(reservedDiff).toHaveTextContent('Reserved volume');
    expect(reservedDiff).toHaveTextContent('Errors50K100K');
    expect(reservedDiff).not.toHaveTextContent('Replays'); // doesn't show any other categories if there are no changes

    expect(paygDiff).toHaveTextContent('PAYG spend limit');
    expect(paygDiff).toHaveTextContent('$100');
  });

  it('does not render for returning customers with no changes', () => {
    renderCartDiff({formData: defaultFormData});
    expect(screen.queryByTestId('cart-diff')).not.toBeInTheDocument();
  });

  it('does not render for new customers', () => {
    const newSub = SubscriptionFixture({
      organization: org,
      plan: 'am3_f',
    });
    renderCartDiff({formData: defaultFormData, subscription: newSub});
    expect(screen.queryByTestId('cart-diff')).not.toBeInTheDocument();
  });

  it('renders shared to per-category spend limits', async () => {
    const sharedOdSub = SubscriptionFixture({
      organization: org,
      plan: teamAnnualPlan.id,
      onDemandBudgets: {
        budgetMode: OnDemandBudgetMode.SHARED,
        enabled: true,
        sharedMaxBudget: 10_00,
        onDemandSpendUsed: 0,
      },
      isFree: false,
    });
    const formData: CheckoutFormData = {
      ...defaultFormData,
      onDemandBudget: {
        budgetMode: OnDemandBudgetMode.PER_CATEGORY,
        budgets: {
          errors: 10_00,
        },
      },
    };

    renderCartDiff({formData, subscription: sharedOdSub});

    expect(await screen.findByText('Changes')).toBeInTheDocument();
    const paygDiff = await screen.findByTestId('shared-spend-limit-diff');
    expect(paygDiff).toHaveTextContent('PAYG spend limit');
    expect(paygDiff).toHaveTextContent('$10');

    const perCategoryDiff = await screen.findByTestId('per-category-spend-limit-diff');
    expect(perCategoryDiff).toHaveTextContent('Per-product spend limits');
    expect(perCategoryDiff).toHaveTextContent('Errors$10');
  });

  it('renders per-category to shared spend limits', async () => {
    const perCategorySub = SubscriptionFixture({
      organization: org,
      plan: teamAnnualPlan.id,
      onDemandBudgets: {
        budgetMode: OnDemandBudgetMode.PER_CATEGORY,
        budgets: {
          errors: 10_00,
          replays: 20_00,
        },
        enabled: true,
        usedSpends: {
          errors: 0,
        },
      },
      isFree: false,
    });

    const formData: CheckoutFormData = {
      ...defaultFormData,
      onDemandBudget: {
        budgetMode: OnDemandBudgetMode.SHARED,
        sharedMaxBudget: 10_00,
      },
    };

    renderCartDiff({formData, subscription: perCategorySub});
    expect(await screen.findByText('Changes')).toBeInTheDocument();
    const paygDiff = await screen.findByTestId('shared-spend-limit-diff');
    expect(paygDiff).toHaveTextContent('PAYG spend limit');
    expect(paygDiff).toHaveTextContent('$10');

    const perCategoryDiff = await screen.findByTestId('per-category-spend-limit-diff');
    expect(perCategoryDiff).toHaveTextContent('Per-product spend limits');
    expect(perCategoryDiff).toHaveTextContent('Errors$10');
    expect(perCategoryDiff).toHaveTextContent('Replays$20');
  });

  it('does not render budget mode change if budgets are $0', () => {
    const formData: CheckoutFormData = {
      ...defaultFormData,
      onDemandBudget: {
        budgetMode: OnDemandBudgetMode.PER_CATEGORY,
        budgets: {
          errors: 0,
        },
      },
    };

    renderCartDiff({formData});
    expect(screen.queryByTestId('cart-diff')).not.toBeInTheDocument();
  });

  it('renders unset to set shared budget as single change', async () => {
    const formData: CheckoutFormData = {
      ...defaultFormData,
      onDemandBudget: {
        budgetMode: OnDemandBudgetMode.SHARED,
        sharedMaxBudget: 10_00,
      },
    };

    renderCartDiff({formData});
    expect(await screen.findByText('Changes')).toBeInTheDocument();
    const paygDiff = await screen.findByTestId('shared-spend-limit-diff');
    expect(paygDiff).toHaveTextContent('PAYG spend limit');
    expect(paygDiff).toHaveTextContent('$10');
    expect(paygDiff).not.toHaveTextContent('$0');
  });

  it('renders unset to set two per-category budget as two changes', async () => {
    const formData: CheckoutFormData = {
      ...defaultFormData,
      onDemandBudget: {
        budgetMode: OnDemandBudgetMode.PER_CATEGORY,
        budgets: {
          errors: 10_00,
          replays: 20_00,
        },
      },
    };

    renderCartDiff({formData});
    expect(await screen.findByText('Changes')).toBeInTheDocument();
    const perCategoryDiff = await screen.findByTestId('per-category-spend-limit-diff');
    expect(perCategoryDiff).toHaveTextContent('Per-product spend limits');
    expect(perCategoryDiff).toHaveTextContent('Errors$10');
    expect(perCategoryDiff).toHaveTextContent('Replays$20');
    expect(perCategoryDiff).not.toHaveTextContent('$0');
    expect(screen.queryByTestId('shared-spend-limit-diff')).not.toBeInTheDocument();
  });

  it('renders set to unset PAYG budget', async () => {
    const subWithBudget = SubscriptionFixture({
      organization: org,
      plan: teamAnnualPlan.id,
      onDemandBudgets: {
        budgetMode: OnDemandBudgetMode.SHARED,
        sharedMaxBudget: 10_00,
        enabled: true,
        onDemandSpendUsed: 0,
      },
      isFree: false,
    });
    const formData: CheckoutFormData = {
      ...defaultFormData,
      onDemandBudget: {
        budgetMode: OnDemandBudgetMode.SHARED,
        sharedMaxBudget: 0,
      },
    };
    renderCartDiff({formData, subscription: subWithBudget});
    expect(await screen.findByText('Changes')).toBeInTheDocument();
    const paygDiff = await screen.findByTestId('shared-spend-limit-diff');
    expect(paygDiff).toHaveTextContent('PAYG spend limit');
    expect(paygDiff).toHaveTextContent('$10$0');
  });
});
