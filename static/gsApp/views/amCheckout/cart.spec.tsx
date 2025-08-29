import moment from 'moment-timezone';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {BillingConfigFixture} from 'getsentry-test/fixtures/billingConfig';
import {PlanDetailsLookupFixture} from 'getsentry-test/fixtures/planDetailsLookup';
import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, within} from 'sentry-test/reactTestingLibrary';
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
    isNewCheckout: true,
  };
  const businessPlan = PlanDetailsLookupFixture('am3_business');
  const teamPlanAnnual = PlanDetailsLookupFixture('am3_team_auf');
  const legacyTeamPlan = PlanDetailsLookupFixture('am2_team');

  const defaultFormData: CheckoutFormData = {
    plan: 'am3_business',
    reserved: {
      ...Object.fromEntries(
        Object.entries(businessPlan!.planCategories).map(([category, buckets]) => [
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
  });

  afterEach(() => {
    resetMockDate();
  });

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
    expect(cart).toHaveTextContent('Pay-as-you-go spend cap$0-$300/mo');
    expect(cart).toHaveTextContent('Plan Total$89/mo');
    expect(within(cart).getByRole('button', {name: 'Confirm and pay'})).toBeEnabled();
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
        activePlan={teamPlanAnnual!}
        formData={formData}
        hasCompleteBillingDetails
        organization={organization}
        subscription={subscription}
      />
    );

    const planItem = await screen.findByTestId('summary-item-plan');
    expect(planItem).toHaveTextContent('Team Plan');
    expect(planItem).toHaveTextContent('$312/yr');
    expect(planItem).toHaveTextContent('25 GB attachments');
    expect(planItem).toHaveTextContent('$65/yr');

    const seerItem = screen.getByTestId('summary-item-product-seer');
    expect(seerItem).toHaveTextContent('Seer AI Agent');
    expect(seerItem).toHaveTextContent('$216/yr');

    const spendCapItem = screen.getByTestId('summary-item-spend-cap');
    expect(spendCapItem).toHaveTextContent('$0-$50/mo');
  });

  it('renders per-category spend caps', async () => {
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
        activePlan={legacyTeamPlan!}
        formData={formData}
        hasCompleteBillingDetails
        organization={organization}
        subscription={subscription}
      />
    );

    const spendCapItems = await screen.findAllByTestId(/summary-item-spend-cap/);
    expect(spendCapItems).toHaveLength(4);
    expect(screen.getByTestId('summary-item-spend-cap-errors')).toHaveTextContent(
      '$0-$10/mo'
    );
    expect(screen.getByTestId('summary-item-spend-cap-transactions')).toHaveTextContent(
      '$0-$5/mo'
    );
    expect(screen.getByTestId('summary-item-spend-cap-attachments')).toHaveTextContent(
      '$0-$20/mo'
    );
    expect(screen.getByTestId('summary-item-spend-cap-replays')).toHaveTextContent(
      '$0-$15/mo'
    );
  });

  it('renders preview data', async () => {
    MockApiClient.addMockResponse({
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
        activePlan={businessPlan!}
        formData={defaultFormData}
        hasCompleteBillingDetails
        organization={organization}
        subscription={subscription}
      />
    );

    const dueToday = await screen.findByTestId('summary-item-due-today');
    expect(dueToday).toHaveTextContent('$91'); // original price
    expect(dueToday).toHaveTextContent('$80'); // price after credits + additional fees
    expect(screen.getByTestId('summary-item-plan-total')).toHaveTextContent('$89');
    expect(screen.getByTestId('summary-item-sales_tax')).toHaveTextContent('$2');
    expect(screen.getByTestId('summary-item-credit_applied')).toHaveTextContent('-$11');
    expect(screen.getByText('Renews Jun 8, 2022')).toBeInTheDocument();
    expect(screen.queryByText(/Your changes will apply/)).not.toBeInTheDocument();
  });

  it('renders warning and no total for pending changes', async () => {
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
        activePlan={businessPlan!}
        formData={defaultFormData}
        hasCompleteBillingDetails
        organization={organization}
        subscription={subscription}
      />
    );

    expect(await screen.findByTestId('summary-item-due-today')).toHaveTextContent('$0');
    expect(screen.getByTestId('summary-item-plan-total')).toHaveTextContent('$89');
    expect(screen.getByText('Renews Jun 7, 2024')).toBeInTheDocument();
    expect(
      screen.getByText(/Your changes will apply on Jun 7, 2023/)
    ).toBeInTheDocument();
  });

  it('disables confirm and pay button for incomplete billing details', async () => {
    render(
      <Cart
        activePlan={businessPlan!}
        formData={defaultFormData}
        hasCompleteBillingDetails={false}
        organization={organization}
        subscription={subscription}
      />
    );
    expect(await screen.findByRole('button', {name: 'Confirm and pay'})).toBeDisabled();
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
        activePlan={businessPlan!}
        formData={defaultFormData}
        hasCompleteBillingDetails
        organization={partnerOrg}
        subscription={partnerSub}
      />
    );

    expect(await screen.findByRole('button', {name: 'Migrate Now'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Schedule changes'})).toBeInTheDocument();
    expect(
      screen.queryByRole('button', {name: 'Confirm and pay'})
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(
        /These changes will take effect at the end of your current Partner sponsored plan on Jun 14, 2022/
      )
    ).toBeInTheDocument();
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
        activePlan={businessPlan!}
        formData={defaultFormData}
        hasCompleteBillingDetails
        organization={organization}
        subscription={partnerSub}
      />
    );

    expect(await screen.findByText(/you will be billed by Partner/)).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Confirm and pay'})).toBeInTheDocument();
  });
});
