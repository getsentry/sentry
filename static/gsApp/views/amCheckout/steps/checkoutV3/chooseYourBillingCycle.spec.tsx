import {LocationFixture} from 'sentry-fixture/locationFixture';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {RouteComponentPropsFixture} from 'sentry-fixture/routeComponentPropsFixture';

import {BillingConfigFixture} from 'getsentry-test/fixtures/billingConfig';
import {PlanDetailsLookupFixture} from 'getsentry-test/fixtures/planDetailsLookup';
import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';
import {resetMockDate, setMockDate} from 'sentry-test/utils';

import SubscriptionStore from 'getsentry/stores/subscriptionStore';
import {PlanTier} from 'getsentry/types';
import AMCheckout from 'getsentry/views/amCheckout/';

describe('ChooseYourBillingCycle', () => {
  const api = new MockApiClient();
  const organization = OrganizationFixture();
  const subscription = SubscriptionFixture({organization, plan: 'am3_f'});

  beforeEach(() => {
    api.clear();
    setMockDate(new Date('2025-08-13'));
    MockApiClient.clearMockResponses();
    SubscriptionStore.set(organization.slug, subscription);

    MockApiClient.addMockResponse({
      url: `/subscriptions/${organization.slug}/`,
      method: 'GET',
      body: {},
    });
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/billing-config/`,
      method: 'GET',
      body: BillingConfigFixture(PlanTier.AM3),
    });
    MockApiClient.addMockResponse({
      method: 'POST',
      url: '/_experiment/log_exposure/',
      body: {},
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/promotions/trigger-check/`,
      method: 'POST',
      body: {},
    });
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/plan-migrations/?applied=0`,
      method: 'GET',
      body: {},
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
    });
  });

  afterEach(() => {
    resetMockDate();
    organization.features = [];
  });

  async function assertCycleText({
    monthlyInfo,
    yearlyInfo,
  }: {
    monthlyInfo: string | RegExp;
    yearlyInfo: string | RegExp;
  }) {
    expect(await screen.findByText('Choose your billing cycle')).toBeInTheDocument();

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
      within(yearlyOption).getByText("Discount doesn't apply to pay-as-you-go usage")
    ).toBeInTheDocument();
  }

  function renderCheckout(isNewCheckout: boolean, referrer?: string) {
    let location = LocationFixture();
    if (referrer) {
      location = LocationFixture({
        query: {
          referrer,
        },
      });
    }
    render(
      <AMCheckout
        {...RouteComponentPropsFixture()}
        api={api}
        onToggleLegacy={jest.fn()}
        checkoutTier={PlanTier.AM3}
        isNewCheckout={isNewCheckout}
        location={location}
        navigate={jest.fn()}
      />,
      {organization}
    );
  }

  it('renders for coterm upgrade', async () => {
    renderCheckout(true);
    await assertCycleText({
      monthlyInfo: /Billed monthly starting on August 13/,
      yearlyInfo: /Billed every 12 months on the 13th of August/,
    });
  });

  it('renders for monthly downgrade', async () => {
    const annualSub = SubscriptionFixture({
      planDetails: PlanDetailsLookupFixture('am2_business_auf'),
      contractPeriodStart: '2025-07-16',
      contractPeriodEnd: '2026-07-15',
      organization,
    });
    SubscriptionStore.set(organization.slug, annualSub);
    renderCheckout(true);
    await assertCycleText({
      monthlyInfo: /Billed monthly starting on July 16/,
      yearlyInfo: /Billed every 12 months on the 13th of August/, // annual can be applied immediately
    });
  });

  it('renders for migrating partner customers', async () => {
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
    renderCheckout(true);
    await assertCycleText({
      monthlyInfo: /Billed monthly starting on your selected start date on submission/,
      yearlyInfo: /Billed every 12 months from your selected start date on submission/,
    });
  });

  it('can select billing cycle', async () => {
    renderCheckout(true);

    const monthly = await screen.findByRole('radio', {name: 'Monthly billing cycle'});
    const annual = screen.getByRole('radio', {name: 'Yearly billing cycle'});

    expect(monthly).toBeChecked();
    expect(annual).not.toBeChecked();

    await userEvent.click(annual);
    expect(monthly).not.toBeChecked();
    expect(annual).toBeChecked();
  });
});
