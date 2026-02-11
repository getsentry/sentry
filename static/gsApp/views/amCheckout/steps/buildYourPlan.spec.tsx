import {LocationFixture} from 'sentry-fixture/locationFixture';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {RouteComponentPropsFixture} from 'sentry-fixture/routeComponentPropsFixture';

import {BillingConfigFixture} from 'getsentry-test/fixtures/billingConfig';
import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';

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
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/billing-details/`,
      method: 'GET',
    });
  });

  function renderCheckout(referrer?: string) {
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
        checkoutTier={PlanTier.AM3}
        location={location}
        navigate={jest.fn()}
      />,
      {organization}
    );
  }

  it('renders', async () => {
    renderCheckout();

    expect(await screen.findByText('Select a plan')).toBeInTheDocument();
    expect(screen.queryByTestId('body-choose-your-plan')).not.toBeInTheDocument();
  });
  describe('PlanSubstep', () => {
    it('annotates the current plan', async () => {
      const bizOrg = OrganizationFixture();
      const businessSubscription = SubscriptionFixture({
        organization: bizOrg,
        plan: 'am3_business',
      });
      SubscriptionStore.set(bizOrg.slug, businessSubscription);

      renderCheckout();

      const businessPlan = await screen.findByTestId('plan-option-am3_business');
      expect(businessPlan).toBeInTheDocument();
      expect(within(businessPlan).getByText('Current')).toBeInTheDocument();
      const teamPlan = screen.getByTestId('plan-option-am3_team');
      expect(within(teamPlan).queryByText('Current')).not.toBeInTheDocument();
    });

    it('can select plan', async () => {
      renderCheckout();

      const teamPlan = await screen.findByRole('radio', {name: 'Team'});
      const businessPlan = screen.getByRole('radio', {name: 'Business'});

      expect(teamPlan).not.toBeChecked();
      expect(businessPlan).toBeChecked();

      await userEvent.click(teamPlan);
      expect(teamPlan).toBeChecked();
      expect(businessPlan).not.toBeChecked();
    });
  });
});
