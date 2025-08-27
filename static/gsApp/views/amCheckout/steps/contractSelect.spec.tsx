import {OrganizationFixture} from 'sentry-fixture/organization';
import {RouteComponentPropsFixture} from 'sentry-fixture/routeComponentPropsFixture';

import {BillingConfigFixture} from 'getsentry-test/fixtures/billingConfig';
import {PlanDetailsLookupFixture} from 'getsentry-test/fixtures/planDetailsLookup';
import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';
import {resetMockDate, setMockDate} from 'sentry-test/utils';

import SubscriptionStore from 'getsentry/stores/subscriptionStore';
import type {Subscription as SubscriptionType} from 'getsentry/types';
import {PlanTier} from 'getsentry/types';
import AMCheckout from 'getsentry/views/amCheckout/';

describe('ContractSelect', () => {
  const api = new MockApiClient();
  const organization = OrganizationFixture();
  const subscription = SubscriptionFixture({
    organization,
    contractPeriodStart: '2025-07-16',
    contractPeriodEnd: '2025-08-15',
  });
  const params = {};

  const warningText = /You are currently on an annual contract/;

  function renderView({isNewCheckout}: {isNewCheckout?: boolean} = {}) {
    return render(
      <AMCheckout
        {...RouteComponentPropsFixture()}
        params={params}
        api={api}
        onToggleLegacy={jest.fn()}
        checkoutTier={PlanTier.AM2}
        organization={organization}
        isNewCheckout={isNewCheckout}
      />
    );
  }

  beforeEach(() => {
    setMockDate(new Date('2025-08-13'));
    SubscriptionStore.set(organization.slug, subscription);

    MockApiClient.addMockResponse({
      url: `/subscriptions/${organization.slug}/`,
      method: 'GET',
      body: {},
    });
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/billing-config/`,
      method: 'GET',
      body: BillingConfigFixture(PlanTier.AM2),
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/promotions/trigger-check/`,
      method: 'POST',
    });
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/plan-migrations/?applied=0`,
      method: 'GET',
      body: [],
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
    organization.features = [];
  });

  async function assertAndOpenPanel({isNewCheckout}: {isNewCheckout: boolean}) {
    const header = await screen.findByTestId('header-contract-term-discounts');
    expect(within(header).getByText('Contract Term & Discounts')).toBeInTheDocument();
    // Panel starts off closed.
    expect(screen.queryByText('Monthly')).not.toBeInTheDocument();
    expect(screen.queryByText('Annual Contract')).not.toBeInTheDocument();

    await userEvent.click(within(header).getByLabelText('Expand section'));

    // Panel should be open and options visible.
    expect(screen.getByText('Monthly')).toBeInTheDocument();
    expect(
      screen.getByText(isNewCheckout ? 'Yearly' : 'Annual Contract')
    ).toBeInTheDocument();
    expect(screen.getByDisplayValue('monthly')).toBeInTheDocument();
    expect(screen.getByDisplayValue('annual')).toBeInTheDocument();
  }

  function assertCheckoutV3Text({
    monthlyInfo,
    yearlyInfo,
  }: {
    monthlyInfo: string | RegExp;
    yearlyInfo: string | RegExp;
  }) {
    const monthlyOption = screen.getByTestId('billing-cycle-option-monthly');
    expect(within(monthlyOption).getByText('Monthly')).toBeInTheDocument();
    expect(within(monthlyOption).queryByText('save 10%')).not.toBeInTheDocument();
    expect(within(monthlyOption).getByText(monthlyInfo)).toBeInTheDocument();
    expect(within(monthlyOption).getByText('Cancel anytime')).toBeInTheDocument();

    const yearlyOption = screen.getByTestId('billing-cycle-option-annual');
    expect(within(yearlyOption).getByText('Yearly')).toBeInTheDocument();
    expect(within(yearlyOption).getByText('save 10%')).toBeInTheDocument();
    expect(within(yearlyOption).getByText(yearlyInfo)).toBeInTheDocument();
    expect(
      within(yearlyOption).getByText("Discount doesn't apply to on-demand usage")
    ).toBeInTheDocument();
  }

  it('renders', async () => {
    renderView();
    await assertAndOpenPanel({isNewCheckout: false});

    // does not show event price tags
    expect(screen.queryByText(/\ error/)).not.toBeInTheDocument();
    expect(screen.queryByText(/\ span/)).not.toBeInTheDocument();
  });

  it('renders for coterm upgrade for checkout v3', async () => {
    renderView({isNewCheckout: true});
    await assertAndOpenPanel({isNewCheckout: true});
    assertCheckoutV3Text({
      monthlyInfo: /Billed monthly starting on August 13/,
      yearlyInfo: /Billed every 12 months on the 13th of August/,
    });
  });

  it('renders for monthly downgrade for checkout v3', async () => {
    const annualSub = SubscriptionFixture({
      planDetails: PlanDetailsLookupFixture('am2_business_auf'),
      contractPeriodStart: '2025-07-16',
      contractPeriodEnd: '2026-07-15',
      organization,
    });
    SubscriptionStore.set(organization.slug, annualSub);
    renderView({isNewCheckout: true});
    await assertAndOpenPanel({isNewCheckout: true});
    assertCheckoutV3Text({
      monthlyInfo: /Billed monthly starting on July 16/,
      yearlyInfo: /Billed every 12 months on the 13th of August/, // annual can be applied immediately
    });
  });

  it('renders for partner migration for checkout v3', async () => {
    const partnerSub = SubscriptionFixture({
      contractInterval: 'annual',
      sponsoredType: 'FOO',
      partner: {
        isActive: true,
        externalId: 'foo',
        partnership: {
          id: 'foo',
          displayName: 'FOO',
          supportNote: '',
        },
        name: '',
      },
      organization,
    });
    SubscriptionStore.set(organization.slug, partnerSub);
    renderView({isNewCheckout: true});
    await assertAndOpenPanel({isNewCheckout: true});
    assertCheckoutV3Text({
      monthlyInfo: /Billed monthly starting on your selected start date on submission/,
      yearlyInfo: /Billed every 12 months from your selected start date on submission/,
    });
  });

  it('can select contract term', async () => {
    renderView();

    // Open the section.
    const header = await screen.findByTestId('header-contract-term-discounts');
    await userEvent.click(within(header).getByLabelText('Expand section'));

    await userEvent.click(screen.getByRole('radio', {name: 'Monthly'}));
    expect(screen.getByRole('radio', {name: 'Monthly'})).toBeChecked();

    await userEvent.click(screen.getByRole('radio', {name: 'Annual Contract'}));
    expect(screen.getByRole('radio', {name: 'Annual Contract'})).toBeChecked();
  });

  it('can complete step', async () => {
    renderView();

    // Open the section.
    const header = await screen.findByTestId('header-contract-term-discounts');
    await userEvent.click(within(header).getByLabelText('Expand section'));

    // Choose monthly
    await userEvent.click(screen.getByRole('radio', {name: 'Monthly'}));
    expect(screen.getByRole('radio', {name: 'Monthly'})).toBeChecked();

    await userEvent.click(screen.getByRole('button', {name: 'Continue'}));

    // Radio should hide
    expect(screen.queryByRole('radio', {name: 'Monthly'})).not.toBeInTheDocument();
    expect(within(header).getByText('Edit')).toBeInTheDocument();
  });

  it('renders annual contract warning', async () => {
    const sub: SubscriptionType = {...subscription, contractInterval: 'annual'};
    SubscriptionStore.set(organization.slug, sub);

    renderView();
    // Open the section
    const header = await screen.findByTestId('header-contract-term-discounts');
    await userEvent.click(within(header).getByLabelText('Expand section'));

    // Stay on annual contract
    await userEvent.click(screen.getByRole('radio', {name: 'Annual Contract'}));
    expect(screen.queryByText(warningText)).not.toBeInTheDocument();

    // Going to monthly should show a warning
    await userEvent.click(screen.getByRole('radio', {name: 'Monthly'}));
    expect(screen.getByText(warningText)).toBeInTheDocument();
  });

  it('does not render annual contract warning for monthly plan', async () => {
    renderView();
    // Open the section
    const header = await screen.findByTestId('header-contract-term-discounts');
    await userEvent.click(within(header).getByLabelText('Expand section'));

    // Choosing annual = no warning.
    await userEvent.click(screen.getByRole('radio', {name: 'Annual Contract'}));
    expect(screen.queryByText(warningText)).not.toBeInTheDocument();

    // Same for monthly.
    await userEvent.click(screen.getByRole('radio', {name: 'Monthly'}));
    expect(screen.queryByText(warningText)).not.toBeInTheDocument();
  });

  it('does not render annual contract warning for FL sponsored plan', async () => {
    const sub: SubscriptionType = {
      ...subscription,
      contractInterval: 'annual',
      sponsoredType: 'FOO',
      partner: {
        isActive: true,
        externalId: 'foo',
        partnership: {
          id: 'FL',
          displayName: 'FOO',
          supportNote: '',
        },
        name: '',
      },
    };

    SubscriptionStore.set(organization.slug, sub);
    renderView();

    // Open the section
    const header = await screen.findByTestId('header-contract-term-discounts');
    await userEvent.click(within(header).getByLabelText('Expand section'));

    // Choosing annual = no warning.
    await userEvent.click(screen.getByRole('radio', {name: 'Annual Contract'}));
    expect(screen.queryByText(warningText)).not.toBeInTheDocument();

    // Same for monthly.
    await userEvent.click(screen.getByRole('radio', {name: 'Monthly'}));
    expect(screen.queryByText(warningText)).not.toBeInTheDocument();
  });
});
