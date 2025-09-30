import moment from 'moment-timezone';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {BillingConfigFixture} from 'getsentry-test/fixtures/billingConfig';
import {BillingDetailsFixture} from 'getsentry-test/fixtures/billingDetails';
import {PlanDetailsLookupFixture} from 'getsentry-test/fixtures/planDetailsLookup';
import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {initializeOrg} from 'sentry-test/initializeOrg';
import {
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';
import {resetMockDate, setMockDate} from 'sentry-test/utils';

import SubscriptionStore from 'getsentry/stores/subscriptionStore';
import {InvoiceItemType, OnDemandBudgetMode, PlanTier} from 'getsentry/types';
import AMCheckout from 'getsentry/views/amCheckout/';
import Cart from 'getsentry/views/amCheckout/cart';
import {SelectableProduct, type CheckoutFormData} from 'getsentry/views/amCheckout/types';

// Jun 06 2022 - with milliseconds
const MOCK_TODAY = 1654492173000;

describe('Cart', () => {
  const {organization, routerProps} = initializeOrg();
  const subscription = SubscriptionFixture({organization, plan: 'am3_f'});
  const billingConfig = BillingConfigFixture(PlanTier.AM3);
  const props = {
    ...routerProps,
    navigate: jest.fn(),
    isNewCheckout: true,
  };
  const businessPlan = PlanDetailsLookupFixture('am3_business')!;
  const teamPlanAnnual = PlanDetailsLookupFixture('am3_team_auf')!;
  const legacyTeamPlan = PlanDetailsLookupFixture('am2_team')!;

  const defaultFormData: CheckoutFormData = {
    plan: 'am3_business',
    reserved: {
      ...Object.fromEntries(
        Object.entries(businessPlan.planCategories).map(([category, buckets]) => [
          category,
          buckets[0]!.events,
        ])
      ),
      seerAutofix: 0,
      seerScanner: 0,
    },
  };

  beforeEach(() => {
    setMockDate(MOCK_TODAY);
    MockApiClient.clearMockResponses();
    SubscriptionStore.set(organization.slug, subscription);
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/plan-migrations/?applied=0`,
      method: 'GET',
      body: {},
    });
    MockApiClient.addMockResponse({
      url: `/subscriptions/${organization.slug}/`,
      method: 'GET',
      body: {},
    });
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/billing-config/`,
      method: 'GET',
      body: billingConfig,
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/promotions/trigger-check/`,
      method: 'POST',
    });
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/subscription/preview/`,
      method: 'GET',
      body: {
        invoiceItems: [],
      },
    });
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/billing-details/`,
      method: 'GET',
      body: BillingDetailsFixture(),
    });
  });

  afterEach(() => {
    resetMockDate();
  });

  function getFormDataForPreview(formData: CheckoutFormData) {
    return {
      ...formData,
      onDemandMaxSpend: undefined,
      onDemandBudget: undefined,
    };
  }

  it('renders with default selections', async () => {
    render(
      <AMCheckout
        api={new MockApiClient()}
        checkoutTier={PlanTier.AM3}
        onToggleLegacy={jest.fn()}
        {...props}
      />
    );
    const cart = await screen.findByTestId('cart');
    expect(cart).toHaveTextContent('Business Plan');
    expect(cart).toHaveTextContent('Pay-as-you-go spend limitup to $300/mo');
    expect(cart).toHaveTextContent('Plan Total$89/mo');
    expect(cart).toHaveTextContent('Default Amount');
  });

  it('renders form data', async () => {
    const formData: CheckoutFormData = {
      plan: 'am3_team_auf',
      reserved: {
        ...defaultFormData.reserved,
        attachments: 25,
      },
      onDemandBudget: {
        budgetMode: OnDemandBudgetMode.SHARED,
        sharedMaxBudget: 50_00,
      },
      onDemandMaxSpend: 50_00,
      selectedProducts: {
        [SelectableProduct.SEER]: {
          enabled: true,
        },
      },
    };

    render(
      <Cart
        activePlan={teamPlanAnnual}
        formData={formData}
        formDataForPreview={getFormDataForPreview(formData)}
        organization={organization}
        subscription={subscription}
        onSuccess={jest.fn()}
      />
    );

    const planItem = await screen.findByTestId('summary-item-plan');
    expect(planItem).toHaveTextContent('Team Plan');
    expect(planItem).toHaveTextContent('$312/yr');
    expect(planItem).toHaveTextContent('25 GB attachments');
    expect(planItem).toHaveTextContent('$65/yr');

    // PAYG-only categories are also shown for paid plans
    expect(planItem).toHaveTextContent('Continuous profile hours');
    expect(planItem).toHaveTextContent('Available');

    const seerItem = screen.getByTestId('summary-item-product-seer');
    expect(seerItem).toHaveTextContent('Seer');
    expect(seerItem).toHaveTextContent('$216/yr');

    const spendCapItem = screen.getByTestId('summary-item-spend-limit');
    expect(spendCapItem).toHaveTextContent('up to $50/mo');

    expect(screen.queryByTestId('cart-diff')).not.toBeInTheDocument(); // changes aren't shown for free plan

    // immediate changes are shown for free plan
    expect(screen.getByRole('button', {name: 'Confirm and pay'})).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Confirm'})).not.toBeInTheDocument();
  });

  it('renders per-category spend limits', async () => {
    const formData: CheckoutFormData = {
      plan: 'am2_team',
      reserved: {
        errors: 100000,
        attachments: 1,
        replays: 50,
        transactions: 100_000,
        monitorSeats: 1,
        profileDuration: 0,
        profileDurationUI: 0,
        uptime: 1,
      },
      onDemandMaxSpend: 50_00,
      onDemandBudget: {
        budgetMode: OnDemandBudgetMode.PER_CATEGORY,
        budgets: {
          errors: 10_00,
          transactions: 5_00,
          replays: 15_00,
          attachments: 20_00,
          monitorSeats: 0, // explicitly 0
        },
      },
    };

    render(
      <Cart
        activePlan={legacyTeamPlan}
        formData={formData}
        formDataForPreview={getFormDataForPreview(formData)}
        organization={organization}
        subscription={subscription}
        onSuccess={jest.fn()}
      />
    );

    const spendCapItems = await screen.findAllByTestId(/summary-item-spend-limit/);
    expect(spendCapItems).toHaveLength(4);
    expect(screen.getByTestId('summary-item-spend-limit-errors')).toHaveTextContent(
      'up to $10/mo'
    );
    expect(screen.getByTestId('summary-item-spend-limit-transactions')).toHaveTextContent(
      'up to $5/mo'
    );
    expect(screen.getByTestId('summary-item-spend-limit-attachments')).toHaveTextContent(
      'up to $20/mo'
    );
    expect(screen.getByTestId('summary-item-spend-limit-replays')).toHaveTextContent(
      'up to $15/mo'
    );
  });

  it('does not fetch preview data if billing info is incomplete', async () => {
    const mockResponse = MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/subscription/preview/`,
      method: 'GET',
      body: {
        invoiceItems: [],
      },
    });
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/billing-details/`,
      method: 'GET',
    });

    render(
      <Cart
        activePlan={businessPlan}
        formData={defaultFormData}
        formDataForPreview={getFormDataForPreview(defaultFormData)}
        organization={organization}
        subscription={subscription}
        onSuccess={jest.fn()}
      />
    );

    expect(await screen.findByRole('button', {name: 'Confirm and pay'})).toBeDisabled();
    expect(mockResponse).not.toHaveBeenCalled();
    expect(screen.getByText('Plan renews monthly.')).toBeInTheDocument(); // no renewal date specified
  });

  it('renders preview data', async () => {
    const mockResponse = MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/subscription/preview/`,
      method: 'GET',
      body: {
        effectiveAt: new Date(MOCK_TODAY).toISOString(),
        billedAmount: 80_00,
        proratedAmount: 91_00,
        creditApplied: 11_00,
        invoiceItems: [
          {
            amount: 2_00,
            description: 'Tax',
            type: InvoiceItemType.SALES_TAX,
          },
          {
            amount: 89_00,
            description: 'Business Plan',
            period_end: moment(MOCK_TODAY).add(1, 'day').format('YYYY-MM-DD'),
            type: InvoiceItemType.SUBSCRIPTION,
          },
        ],
      },
    });

    render(
      <Cart
        activePlan={businessPlan}
        formData={defaultFormData}
        formDataForPreview={getFormDataForPreview(defaultFormData)}
        organization={organization}
        subscription={subscription}
        onSuccess={jest.fn()}
      />
    );

    const dueToday = await screen.findByTestId('summary-item-due-today');
    expect(mockResponse).toHaveBeenCalled();

    // wait for preview to be loaded
    await waitFor(() => expect(dueToday).toHaveTextContent('$91')); // original price
    expect(dueToday).toHaveTextContent('$80'); // price after credits + additional fees
    expect(screen.getByTestId('summary-item-plan-total')).toHaveTextContent('$89');
    expect(screen.getByTestId('summary-item-sales_tax')).toHaveTextContent('$2');
    expect(screen.getByTestId('summary-item-credit_applied')).toHaveTextContent('-$11');
    expect(screen.getByText('Renews Jun 8, 2022')).toBeInTheDocument();
    expect(screen.queryByText(/Your changes will apply/)).not.toBeInTheDocument();
  });

  it('renders future total for pending changes', async () => {
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/subscription/preview/`,
      method: 'GET',
      body: {
        atPeriodEnd: true,
        effectiveAt: moment(MOCK_TODAY).add(1, 'year').format('YYYY-MM-DD'),
        billedAmount: 89_00,
        invoiceItems: [
          {
            amount: 89_00,
            description: 'Business Plan',
            period_end: moment(MOCK_TODAY).add(2, 'year').format('YYYY-MM-DD'),
            type: InvoiceItemType.SUBSCRIPTION,
          },
        ],
      },
    });

    render(
      <Cart
        activePlan={businessPlan}
        formData={defaultFormData}
        formDataForPreview={getFormDataForPreview(defaultFormData)}
        organization={organization}
        subscription={subscription}
        onSuccess={jest.fn()}
      />
    );

    // wait for preview to be loaded
    await waitFor(() =>
      expect(screen.getByTestId('summary-item-due-today')).toHaveTextContent(
        'Due on Jun 7, 2023'
      )
    );
    expect(screen.getByTestId('summary-item-due-today')).toHaveTextContent('$89 USD');
    expect(screen.getByTestId('summary-item-plan-total')).toHaveTextContent('$89');
    expect(screen.getByText('Renews Jun 7, 2024')).toBeInTheDocument();
    expect(
      screen.getByText(/Your changes will apply on Jun 7, 2023/)
    ).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Confirm'})).toBeInTheDocument();
    expect(
      screen.queryByRole('button', {name: 'Confirm and pay'})
    ).not.toBeInTheDocument();
  });

  it('renders buttons and subtext for migrating partner customers', async () => {
    const partnerOrg = OrganizationFixture({features: ['partner-billing-migration']});
    const partnerSub = SubscriptionFixture({
      organization: partnerOrg,
      partner: {
        externalId: 'whateva',
        isActive: true,
        partnership: {
          displayName: 'Partner',
          id: '123',
          supportNote: 'Support note',
        },
        name: 'partner',
      },
      contractPeriodEnd: moment(MOCK_TODAY).add(7, 'days').toISOString(),
    });

    render(
      <Cart
        activePlan={businessPlan}
        formData={defaultFormData}
        formDataForPreview={getFormDataForPreview(defaultFormData)}
        organization={partnerOrg}
        subscription={partnerSub}
        onSuccess={jest.fn()}
      />
    );

    expect(await screen.findByRole('button', {name: 'Migrate Now'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Schedule changes'})).toBeInTheDocument();
    expect(
      screen.queryByRole('button', {name: 'Confirm and pay'})
    ).not.toBeInTheDocument();
    // wait for preview to be loaded
    await screen.findByText(
      /These changes will take effect at the end of your current Partner sponsored plan on Jun 14, 2022/
    );
    expect(screen.queryByTestId('cart-diff')).not.toBeInTheDocument(); // changes aren't shown for migrating partner customers
  });

  it('renders subtext for self-serve partner customers', async () => {
    const partnerSub = SubscriptionFixture({
      organization,
      isSelfServePartner: true,
      partner: {
        externalId: 'whateva',
        isActive: true,
        partnership: {
          displayName: 'Partner',
          id: '123',
          supportNote: 'Support note',
        },
        name: 'partner',
      },
    });

    render(
      <Cart
        activePlan={businessPlan}
        formData={defaultFormData}
        formDataForPreview={getFormDataForPreview(defaultFormData)}
        organization={organization}
        subscription={partnerSub}
        onSuccess={jest.fn()}
      />
    );

    // wait for preview to be loaded
    await screen.findByText(/you will be billed by Partner/);
    expect(screen.getByRole('button', {name: 'Confirm and pay'})).toBeInTheDocument();
  });

  it('renders changes for returning customers', async () => {
    const paidSub = SubscriptionFixture({
      organization,
      plan: 'am3_business',
      isFree: false,
    });
    SubscriptionStore.set(organization.slug, paidSub);

    const formData: CheckoutFormData = {
      plan: 'am3_team_auf',
      reserved: {
        ...defaultFormData.reserved,
        attachments: 25,
        spans: 20_000_000,
      },
      onDemandBudget: {
        budgetMode: OnDemandBudgetMode.SHARED,
        sharedMaxBudget: 1_00,
      },
      selectedProducts: {
        [SelectableProduct.SEER]: {
          enabled: true,
        },
      },
    };

    render(
      <Cart
        activePlan={teamPlanAnnual}
        formData={formData}
        formDataForPreview={getFormDataForPreview(formData)}
        organization={organization}
        subscription={paidSub}
        onSuccess={jest.fn()}
      />
    );

    const changes = await screen.findByTestId('cart-diff');
    expect(changes).toHaveTextContent('Changes (6)');
    const planChanges = within(changes).getByTestId('plan-diff');
    expect(planChanges).toHaveTextContent('Plan');

    const reservedChanges = within(changes).getByTestId('reserved-diff');
    expect(reservedChanges).toHaveTextContent('Reserved volume');

    const sharedSpendCapChanges = within(changes).getByTestId('shared-spend-limit-diff');
    expect(sharedSpendCapChanges).toHaveTextContent('PAYG spend limit');
  });

  it('can toggle changes and plan summary', async () => {
    const paidSub = SubscriptionFixture({
      organization,
      plan: 'am3_business_auf',
      isFree: false,
    });
    SubscriptionStore.set(organization.slug, paidSub);

    render(
      <Cart
        activePlan={businessPlan}
        formData={defaultFormData}
        formDataForPreview={getFormDataForPreview(defaultFormData)}
        organization={organization}
        subscription={paidSub}
        onSuccess={jest.fn()}
      />
    );

    const changes = await screen.findByTestId('cart-diff');
    expect(within(changes).getByText('Plan')).toBeInTheDocument();

    const planSummary = await screen.findByTestId('plan-summary');
    expect(within(planSummary).getByText('Business Plan')).toBeInTheDocument();

    const changesButton = await screen.findByRole('button', {name: 'Hide changes'});
    const planSummaryButton = await screen.findByRole('button', {
      name: 'Hide plan summary',
    });

    await userEvent.click(changesButton);
    expect(within(changes).queryByText('Plan')).not.toBeInTheDocument();

    await userEvent.click(planSummaryButton);
    expect(within(planSummary).queryByText('Business Plan')).not.toBeInTheDocument();
  });
});
