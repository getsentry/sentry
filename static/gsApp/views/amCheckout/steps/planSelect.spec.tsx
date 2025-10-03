import moment from 'moment-timezone';
import {LocationFixture} from 'sentry-fixture/locationFixture';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {RouteComponentPropsFixture} from 'sentry-fixture/routeComponentPropsFixture';

import {BillingConfigFixture} from 'getsentry-test/fixtures/billingConfig';
import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {ANNUAL} from 'getsentry/constants';
import SubscriptionStore from 'getsentry/stores/subscriptionStore';
import {PlanTier} from 'getsentry/types';
import AMCheckout from 'getsentry/views/amCheckout/';

describe('PlanSelect', () => {
  const api = new MockApiClient();
  const organization = OrganizationFixture();
  const subscription = SubscriptionFixture({organization});

  beforeEach(() => {
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

  it('renders', async () => {
    const freeSubscription = SubscriptionFixture({
      organization,
      plan: 'am2_f',
      isFree: true,
    });
    SubscriptionStore.set(organization.slug, freeSubscription);

    render(
      <AMCheckout
        {...RouteComponentPropsFixture()}
        navigate={jest.fn()}
        api={api}
        onToggleLegacy={jest.fn()}
        checkoutTier={PlanTier.AM2}
      />,
      {organization}
    );

    expect(await screen.findByTestId('body-choose-your-plan')).toBeInTheDocument();
    expect(screen.getByTestId('footer-choose-your-plan')).toBeInTheDocument();
  });

  it('renders checkmarks on team plan', async () => {
    const org = OrganizationFixture();
    const teamSubscription = SubscriptionFixture({
      organization: org,
      plan: 'am2_team',
      isFree: false,
    });
    SubscriptionStore.set(org.slug, teamSubscription);

    render(
      <AMCheckout
        {...RouteComponentPropsFixture()}
        navigate={jest.fn()}
        api={api}
        onToggleLegacy={jest.fn()}
        checkoutTier={PlanTier.AM2}
      />,
      {organization: org}
    );

    const teamPlan = await screen.findByLabelText('Team');
    const businessPlan = screen.getByLabelText('Business');

    expect(teamPlan).toHaveTextContent('Current plan');
    expect(within(teamPlan).getAllByTestId('icon-check-mark')).toHaveLength(3);

    expect(within(businessPlan).queryByTestId('icon-check-mark')).not.toBeInTheDocument();
  });

  it('marks business as the current plan', async () => {
    const org = OrganizationFixture();
    const businessSubscription = SubscriptionFixture({
      organization: org,
      plan: 'am2_business',
      isFree: false,
    });
    SubscriptionStore.set(org.slug, businessSubscription);

    render(
      <AMCheckout
        {...RouteComponentPropsFixture()}
        navigate={jest.fn()}
        api={api}
        onToggleLegacy={jest.fn()}
        checkoutTier={PlanTier.AM2}
      />,
      {organization: org}
    );

    const businessPlan = await screen.findByLabelText('Business');

    expect(businessPlan).toHaveTextContent('Current plan');
    expect(within(businessPlan).queryByTestId('icon-check-mark')).not.toBeInTheDocument();
  });

  it('renders targeted features when have referrer', async () => {
    const org = OrganizationFixture();
    const sub = SubscriptionFixture({
      organization: org,
      plan: 'am2_team',
      isFree: false,
    });
    SubscriptionStore.set(org.slug, sub);

    render(
      <AMCheckout
        {...RouteComponentPropsFixture()}
        navigate={jest.fn()}
        api={api}
        onToggleLegacy={jest.fn()}
        checkoutTier={PlanTier.AM2}
        location={LocationFixture({
          query: {
            referrer: 'upgrade-business-landing.relay',
          },
        })}
      />,
      {organization: org}
    );

    const businessPlan = await screen.findByLabelText('Business');

    const advancedFiltering = within(businessPlan)
      .getByText('Advanced server-side filtering')
      .closest('div');

    if (advancedFiltering) {
      expect(
        within(advancedFiltering).getByText('Looking for this?')
      ).toBeInTheDocument();
    }

    const warningText = textWithMarkupMatcher(
      'This plan does not include Advanced server-side filtering'
    );

    expect(screen.queryByText(warningText)).not.toBeInTheDocument();

    // Clicking the team plan shows a warning that the plan doesn't include the
    // feature they want
    await userEvent.click(screen.getByLabelText('Team'));

    expect(screen.getByText(warningText)).toBeInTheDocument();
  });

  it('renders with correct default prices and errors on-demand pricing', async () => {
    render(
      <AMCheckout
        {...RouteComponentPropsFixture()}
        navigate={jest.fn()}
        api={api}
        onToggleLegacy={jest.fn()}
        checkoutTier={PlanTier.AM2}
      />,
      {organization}
    );

    const teamPlan = await screen.findByLabelText('Team');
    const businessPlan = screen.getByLabelText('Business');

    expect(teamPlan).toHaveTextContent('$29/mo');
    expect(businessPlan).toHaveTextContent('$89/mo');

    expect(teamPlan).toHaveTextContent('$0.000377 / error');
    expect(teamPlan).not.toHaveTextContent(/\/ span/);
    expect(businessPlan).toHaveTextContent('$0.001157 / error');
    expect(businessPlan).not.toHaveTextContent(/\/ span/);
  });

  it('renders with correct default prices and errors and spans on-demand pricing', async () => {
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/billing-config/`,
      method: 'GET',
      body: BillingConfigFixture(PlanTier.AM3),
    });
    render(
      <AMCheckout
        {...RouteComponentPropsFixture()}
        navigate={jest.fn()}
        api={api}
        onToggleLegacy={jest.fn()}
        checkoutTier={PlanTier.AM3}
      />,
      {organization}
    );

    const teamPlan = await screen.findByLabelText('Team');
    const businessPlan = screen.getByLabelText('Business');

    expect(teamPlan).toHaveTextContent('$29/mo');
    expect(businessPlan).toHaveTextContent('$89/mo');

    // NOTE: prices on fixtures are not necessarily correct, just for testing
    expect(teamPlan).toHaveTextContent('$0.000362 / error');
    expect(teamPlan).toHaveTextContent('$0.000002 / span');
    expect(businessPlan).toHaveTextContent('$0.001113 / error');
    expect(businessPlan).toHaveTextContent('$0.000004 / span');
  });

  it('renders with default plan selected', async () => {
    render(
      <AMCheckout
        {...RouteComponentPropsFixture()}
        navigate={jest.fn()}
        api={api}
        onToggleLegacy={jest.fn()}
        checkoutTier={PlanTier.AM2}
      />,
      {organization}
    );

    const teamPlan = await screen.findByLabelText('Team');
    const businessPlan = screen.getByLabelText('Business');

    expect(within(teamPlan).getByRole('radio')).not.toBeChecked();
    expect(within(businessPlan).getByRole('radio')).toBeChecked();
  });

  it('can select plan', async () => {
    render(
      <AMCheckout
        {...RouteComponentPropsFixture()}
        navigate={jest.fn()}
        api={api}
        onToggleLegacy={jest.fn()}
        checkoutTier={PlanTier.AM2}
      />,
      {organization}
    );

    const teamPlan = await screen.findByLabelText('Team');
    const businessPlan = screen.getByLabelText('Business');

    expect(within(teamPlan).getByRole('radio')).not.toBeChecked();
    expect(within(businessPlan).getByRole('radio')).toBeChecked();

    await userEvent.click(teamPlan);

    expect(within(teamPlan).getByRole('radio')).toBeChecked();
    expect(within(businessPlan).getByRole('radio')).not.toBeChecked();
  });

  it('can continue', async () => {
    render(
      <AMCheckout
        {...RouteComponentPropsFixture()}
        navigate={jest.fn()}
        api={api}
        onToggleLegacy={jest.fn()}
        checkoutTier={PlanTier.AM2}
      />,
      {organization}
    );

    expect(await screen.findByTestId('body-choose-your-plan')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name: 'Continue'}));

    expect(screen.queryByTestId('body-choose-your-plan')).not.toBeInTheDocument();
  });

  it('can edit', async () => {
    render(
      <AMCheckout
        {...RouteComponentPropsFixture()}
        navigate={jest.fn()}
        api={api}
        onToggleLegacy={jest.fn()}
        checkoutTier={PlanTier.AM2}
      />,
      {organization}
    );

    expect(await screen.findByTestId('body-choose-your-plan')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name: 'Continue'}));

    expect(screen.queryByTestId('body-choose-your-plan')).not.toBeInTheDocument();

    // Clicking the header opens it back up for editing
    await userEvent.click(screen.getByTestId('header-choose-your-plan'));
    expect(screen.getByTestId('body-choose-your-plan')).toBeInTheDocument();
  });

  it('selects business for am2 monthly plans', async () => {
    const teamOrganization = OrganizationFixture();
    const teamSubscription = SubscriptionFixture({
      organization: teamOrganization,
      plan: 'am2_team',
      isFree: false,
    });
    SubscriptionStore.set(organization.slug, teamSubscription);

    render(
      <AMCheckout
        {...RouteComponentPropsFixture()}
        navigate={jest.fn()}
        api={api}
        onToggleLegacy={jest.fn()}
        checkoutTier={PlanTier.AM2}
        location={LocationFixture({
          query: {
            referrer: 'upsell-test',
          },
        })}
      />,
      {organization}
    );

    const teamPlan = await screen.findByLabelText('Team');
    const businessPlan = screen.getByLabelText('Business');

    expect(within(teamPlan).getByRole('radio')).not.toBeChecked();
    expect(within(businessPlan).getByRole('radio')).toBeChecked();

    expect(teamPlan).toHaveTextContent('Current plan');
  });

  it('selects business for am2 annual plans', async () => {
    const teamOrganization = OrganizationFixture();
    const teamSubscription = SubscriptionFixture({
      organization: teamOrganization,
      plan: 'am2_team_auf',
      contractInterval: ANNUAL,
      isFree: false,
    });
    SubscriptionStore.set(organization.slug, teamSubscription);

    render(
      <AMCheckout
        {...RouteComponentPropsFixture()}
        navigate={jest.fn()}
        api={api}
        onToggleLegacy={jest.fn()}
        checkoutTier={PlanTier.AM2}
        location={LocationFixture({
          query: {
            referrer: 'upsell-test',
          },
        })}
      />,
      {organization}
    );

    const teamPlan = await screen.findByLabelText('Team');
    const businessPlan = screen.getByLabelText('Business');

    expect(within(teamPlan).getByRole('radio')).not.toBeChecked();
    expect(within(businessPlan).getByRole('radio')).toBeChecked();

    expect(teamPlan).toHaveTextContent('Current plan');
  });

  it('selects team for non upsell referrers', async () => {
    const teamOrganization = OrganizationFixture();
    const teamSubscription = SubscriptionFixture({
      organization: teamOrganization,
      plan: 'am2_team',
      isFree: false,
    });
    SubscriptionStore.set(organization.slug, teamSubscription);

    render(
      <AMCheckout
        {...RouteComponentPropsFixture()}
        navigate={jest.fn()}
        api={api}
        onToggleLegacy={jest.fn()}
        checkoutTier={PlanTier.AM2}
        location={LocationFixture({
          query: {
            referrer: 'random_referrer',
          },
        })}
      />,
      {organization}
    );

    const teamPlan = await screen.findByLabelText('Team');
    const businessPlan = screen.getByLabelText('Business');

    expect(within(businessPlan).getByRole('radio')).not.toBeChecked();
    expect(within(teamPlan).getByRole('radio')).toBeChecked();

    expect(teamPlan).toHaveTextContent('Current plan');
  });

  it('shows plan hint', async () => {
    const teamOrganization = OrganizationFixture();

    const teamSubscription = SubscriptionFixture({
      organization: teamOrganization,
      plan: 'am2_team',
      lastTrialEnd: '2000/05/01',
      isFree: false,
    });

    SubscriptionStore.set(organization.slug, teamSubscription);

    render(
      <AMCheckout
        {...RouteComponentPropsFixture()}
        navigate={jest.fn()}
        api={api}
        onToggleLegacy={jest.fn()}
        checkoutTier={PlanTier.AM2}
        location={LocationFixture({
          query: {
            referrer: 'random_referrer',
          },
        })}
      />,
      {organization: teamOrganization}
    );

    const teamPlan = await screen.findByLabelText('Team');
    const businessPlan = screen.getByLabelText('Business');

    expect(within(businessPlan).getByRole('radio')).not.toBeChecked();
    expect(within(teamPlan).getByRole('radio')).toBeChecked();

    expect(businessPlan).toHaveTextContent('You trialed this plan');
  });

  it('shows trial expires', async () => {
    const teamOrganization = OrganizationFixture();

    const teamSubscription = SubscriptionFixture({
      organization: teamOrganization,
      plan: 'am2_t',
      lastTrialEnd: moment().utc().add(2, 'days').format(),
      isFree: false,
      isTrial: true,
    });

    SubscriptionStore.set(organization.slug, teamSubscription);

    render(
      <AMCheckout
        {...RouteComponentPropsFixture()}
        navigate={jest.fn()}
        api={api}
        onToggleLegacy={jest.fn()}
        checkoutTier={PlanTier.AM2}
        location={LocationFixture({
          query: {
            referrer: 'random_referrer',
          },
        })}
      />,
      {organization: teamOrganization}
    );

    await screen.findByLabelText('Business');
    const businessPlan = screen.getByLabelText('Business');
    expect(businessPlan).toHaveTextContent('Trial expires in 2 days');
  });

  it('shows plan trialed', async () => {
    const teamOrganization = OrganizationFixture();

    const teamSubscription = SubscriptionFixture({
      organization: teamOrganization,
      plan: 'am2_t',
      lastTrialEnd: moment().utc().subtract(1, 'days').format(),
      isFree: false,
      isTrial: true,
    });

    SubscriptionStore.set(organization.slug, teamSubscription);

    render(
      <AMCheckout
        {...RouteComponentPropsFixture()}
        navigate={jest.fn()}
        api={api}
        onToggleLegacy={jest.fn()}
        checkoutTier={PlanTier.AM2}
        location={LocationFixture({
          query: {
            referrer: 'random_referrer',
          },
        })}
      />,
      {organization: teamOrganization}
    );

    await screen.findByLabelText('Business');
    const businessPlan = screen.getByLabelText('Business');
    expect(businessPlan).toHaveTextContent('You trialed this plan');
  });

  it('calls prompts activity when business to team downgrade', async () => {
    const mockPromptUpdate = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/prompts-activity/`,
      method: 'PUT',
      body: {
        organizationId: organization.id,
        feature: 'business_to_team_promo',
        status: 'dismissed',
      },
    });

    const org = OrganizationFixture();
    const businessSubscription = SubscriptionFixture({
      organization: org,
      plan: 'am2_business',
      isFree: false,
    });
    SubscriptionStore.set(org.slug, businessSubscription);

    render(
      <AMCheckout
        {...RouteComponentPropsFixture()}
        navigate={jest.fn()}
        api={api}
        onToggleLegacy={jest.fn()}
        checkoutTier={PlanTier.AM2}
      />,
      {organization}
    );

    const teamPlan = await screen.findByLabelText('Team');

    await userEvent.click(teamPlan);
    await userEvent.click(screen.getByRole('button', {name: 'Continue'}));

    expect(mockPromptUpdate).toHaveBeenCalled();
  });

  it('shows correct features for AM2 business plan', async () => {
    render(
      <AMCheckout
        {...RouteComponentPropsFixture()}
        navigate={jest.fn()}
        api={api}
        onToggleLegacy={jest.fn()}
        checkoutTier={PlanTier.AM2}
      />,
      {organization}
    );

    const businessPlan = await screen.findByLabelText('Business');
    expect(businessPlan).toHaveTextContent('Unlimited custom dashboards');
    expect(businessPlan).not.toHaveTextContent('Application Insights');
  });

  it('shows Application Insights for AM3 business plan only', async () => {
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/billing-config/`,
      method: 'GET',
      body: BillingConfigFixture(PlanTier.AM3),
    });

    render(
      <AMCheckout
        {...RouteComponentPropsFixture()}
        navigate={jest.fn()}
        api={api}
        onToggleLegacy={jest.fn()}
        checkoutTier={PlanTier.AM3}
      />,
      {organization}
    );

    const businessPlan = await screen.findByLabelText('Business');
    expect(businessPlan).toHaveTextContent('Application Insights');
    expect(businessPlan).toHaveTextContent('Unlimited custom dashboards');
  });
});
