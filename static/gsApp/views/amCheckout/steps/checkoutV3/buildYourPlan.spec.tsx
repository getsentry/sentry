import {LocationFixture} from 'sentry-fixture/locationFixture';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {RouteComponentPropsFixture} from 'sentry-fixture/routeComponentPropsFixture';

import {BillingConfigFixture} from 'getsentry-test/fixtures/billingConfig';
import {PlanDetailsLookupFixture} from 'getsentry-test/fixtures/planDetailsLookup';
import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';
import {resetMockDate, setMockDate, textWithMarkupMatcher} from 'sentry-test/utils';

import SubscriptionStore from 'getsentry/stores/subscriptionStore';
import {PlanTier} from 'getsentry/types';
import AMCheckout from 'getsentry/views/amCheckout/';

describe('BuildYourPlan', () => {
  const api = new MockApiClient();
  const organization = OrganizationFixture();
  const subscription = SubscriptionFixture({organization, plan: 'am3_f'});

  beforeEach(() => {
    api.clear();
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
  });

  function assertAllSubsteps(isNewCheckout: boolean) {
    const substepTitles = ['Choose one', 'Select additional products', 'Billing cycle'];

    if (isNewCheckout) {
      substepTitles.forEach(title => {
        expect(screen.getByText(title)).toBeInTheDocument();
      });
    } else {
      substepTitles.forEach(title => {
        expect(screen.queryByText(title)).not.toBeInTheDocument();
      });
    }
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
      />,
      {organization}
    );
  }

  it('renders for checkout v3', async () => {
    renderCheckout(true);

    expect(await screen.findByText('Build your plan')).toBeInTheDocument();
    expect(screen.queryByTestId('body-choose-your-plan')).not.toBeInTheDocument();
    assertAllSubsteps(true);
  });

  it('does not render for old checkout', async () => {
    renderCheckout(false);

    expect(await screen.findByTestId('body-choose-your-plan')).toBeInTheDocument();
    expect(screen.queryByText('Build your plan')).not.toBeInTheDocument();
    assertAllSubsteps(false);
  });

  describe('PlanSubstep', () => {
    it('can toggle volume sliders', async () => {
      renderCheckout(true);
      expect(await screen.findByText('Reserve additional volume')).toBeInTheDocument();
      expect(screen.queryByRole('slider')).not.toBeInTheDocument();

      await userEvent.click(
        screen.getByRole('button', {name: 'Show reserved volume sliders'})
      );
      expect(screen.getAllByRole('slider').length).toBeGreaterThan(0);

      await userEvent.click(
        screen.getByRole('button', {name: 'Hide reserved volume sliders'})
      );
      expect(screen.queryByRole('slider')).not.toBeInTheDocument();
    });

    it('annotates the current plan', async () => {
      const bizOrg = OrganizationFixture();
      const businessSubscription = SubscriptionFixture({
        organization: bizOrg,
        plan: 'am3_business',
      });
      SubscriptionStore.set(bizOrg.slug, businessSubscription);

      renderCheckout(true);

      const businessPlan = await screen.findByTestId('plan-option-am3_business');
      expect(businessPlan).toBeInTheDocument();
      expect(within(businessPlan).getByText('Current')).toBeInTheDocument();
      const teamPlan = screen.getByTestId('plan-option-am3_team');
      expect(within(teamPlan).queryByText('Current')).not.toBeInTheDocument();
    });

    it('renders targeted features when there is a referrer', async () => {
      renderCheckout(true, 'upgrade-business-landing.relay');

      const businessPlan = await screen.findByTestId('plan-option-am3_business');
      const teamPlan = screen.getByTestId('plan-option-am3_team');
      const warningText = textWithMarkupMatcher(
        'This plan does not include Advanced server-side filtering'
      );

      await userEvent.click(businessPlan); // ensure we're on the business plan
      expect(within(businessPlan).getByRole('radio')).toBeChecked();

      // We don't nudge the user for features if they're already
      // choosing that plan
      const advancedFiltering = within(businessPlan)
        .getByText('Advanced server-side filtering')
        .closest('div')!;
      await userEvent.click(businessPlan);
      expect(
        within(advancedFiltering).queryByText('Looking for this?')
      ).not.toBeInTheDocument();
      expect(within(teamPlan).queryByText(warningText)).not.toBeInTheDocument();

      // Clicking Team shows all the warnings and nudges
      await userEvent.click(teamPlan);
      expect(within(teamPlan).getByRole('radio')).toBeChecked();
      expect(
        within(advancedFiltering).getByText('Looking for this?')
      ).toBeInTheDocument();
      expect(within(teamPlan).getByText(warningText)).toBeInTheDocument();
    });

    it('can select plan', async () => {
      renderCheckout(true);

      const teamPlan = await screen.findByTestId('plan-option-am3_team');
      const businessPlan = screen.getByTestId('plan-option-am3_business');

      expect(within(teamPlan).getByRole('radio')).not.toBeChecked();
      expect(within(businessPlan).getByRole('radio')).toBeChecked();

      await userEvent.click(teamPlan);
      expect(within(teamPlan).getByRole('radio')).toBeChecked();
      expect(within(businessPlan).getByRole('radio')).not.toBeChecked();
    });
  });

  describe('BillingCycleSubstep', () => {
    beforeEach(() => {
      setMockDate(new Date('2025-08-13'));
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
      expect(await screen.findByText('Billing cycle')).toBeInTheDocument();

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

      const monthly = await screen.findByTestId('billing-cycle-option-monthly');
      const annual = screen.getByTestId('billing-cycle-option-annual');

      expect(within(monthly).getByRole('radio')).toBeChecked();
      expect(within(annual).getByRole('radio')).not.toBeChecked();

      await userEvent.click(annual);
      expect(within(monthly).getByRole('radio')).not.toBeChecked();
      expect(within(annual).getByRole('radio')).toBeChecked();
    });
  });
});
