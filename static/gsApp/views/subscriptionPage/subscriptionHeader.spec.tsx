import moment from 'moment-timezone';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {BillingConfigFixture} from 'getsentry-test/fixtures/billingConfig';
import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {render, screen, within} from 'sentry-test/reactTestingLibrary';

import {PendingChangesFixture} from 'getsentry/__fixtures__/pendingChanges';
import {PlanFixture} from 'getsentry/__fixtures__/plan';
import SubscriptionStore from 'getsentry/stores/subscriptionStore';
import {PlanTier} from 'getsentry/types';
import SubscriptionHeader from 'getsentry/views/subscriptionPage/subscriptionHeader';

describe('SubscriptionHeader', function () {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: `/customers/org-slug/billing-config/`,
      method: 'GET',
      body: BillingConfigFixture(PlanTier.AM1),
    });
    MockApiClient.addMockResponse({
      url: `/subscriptions/org-slug/`,
      method: 'GET',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/promotions/trigger-check/`,
      method: 'POST',
    });
    MockApiClient.addMockResponse({
      url: `/customers/org-slug/plan-migrations/`,
      query: {scheduled: 1, applied: 0},
      method: 'GET',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/prompts-activity/`,
      body: {},
    });
  });

  it('does not render editable sections for YY partnership', async function () {
    const organization = OrganizationFixture({
      features: ['usage-log'],
      access: ['org:billing'],
    });
    const subscription = SubscriptionFixture({
      plan: 'am2_business',
      planTier: 'am2',
      partner: {
        externalId: 'x123x',
        name: 'YY Org',
        partnership: {
          id: 'YY',
          displayName: 'YY',
          supportNote: 'foo',
        },
        isActive: true,
      },
      organization,
      canSelfServe: false,
    });

    SubscriptionStore.set(organization.slug, subscription);
    render(
      <SubscriptionHeader organization={organization} subscription={subscription} />
    );
    expect(await screen.findByTestId('partnership-note')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', {name: 'Manage subscription'})
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Billing Details')).not.toBeInTheDocument();
  });

  it('renders partner plan ending banner for partner orgs with flag and ending contract', function () {
    const organization = OrganizationFixture({
      features: ['usage-log', 'partner-billing-migration'],
      access: ['org:billing'],
    });
    const now = moment();
    const subscription = SubscriptionFixture({
      plan: 'am2_sponsored_team_auf',
      planDetails: PlanFixture({}),
      planTier: 'am2',
      partner: {
        externalId: 'x123x',
        name: 'FOO Org',
        partnership: {
          id: 'FOO',
          displayName: 'FOO',
          supportNote: '',
        },
        isActive: true,
      },
      organization,
      canSelfServe: true,
      contractPeriodEnd: now.add(30, 'days').toString(),
    });

    SubscriptionStore.set(organization.slug, subscription);
    render(
      <SubscriptionHeader organization={organization} subscription={subscription} />
    );
    expect(screen.getByTestId('partner-plan-ending-banner')).toBeInTheDocument();
  });

  it('does not render partner plan ending banner for partner orgs with flag and ending contract greater than 30 days', function () {
    const organization = OrganizationFixture({
      features: ['usage-log', 'partner-billing-migration'],
      access: ['org:billing'],
    });
    const now = moment();
    const subscription = SubscriptionFixture({
      plan: 'am2_sponsored_team_auf',
      planDetails: PlanFixture({}),
      planTier: 'am2',
      partner: {
        externalId: 'x123x',
        name: 'FOO Org',
        partnership: {
          id: 'FOO',
          displayName: 'FOO',
          supportNote: '',
        },
        isActive: true,
      },
      organization,
      canSelfServe: true,
      contractPeriodEnd: now.add(50, 'days').toString(),
    });

    SubscriptionStore.set(organization.slug, subscription);
    render(
      <SubscriptionHeader organization={organization} subscription={subscription} />
    );
    expect(screen.queryByTestId('partner-plan-ending-banner')).not.toBeInTheDocument();
  });

  it('does not render partner plan ending banner for orgs with pending upgrade', function () {
    const organization = OrganizationFixture({
      features: ['usage-log', 'partner-billing-migration'],
      access: ['org:billing'],
    });
    const now = moment();
    const subscription = SubscriptionFixture({
      plan: 'am2_sponsored_team_auf',
      planDetails: PlanFixture({}),
      planTier: 'am2',
      partner: {
        externalId: 'x123x',
        name: 'FOO Org',
        partnership: {
          id: 'FOO',
          displayName: 'FOO',
          supportNote: '',
        },
        isActive: true,
      },
      pendingChanges: PendingChangesFixture({
        plan: 'am3_business',
        planDetails: PlanFixture({
          name: 'Business',
          price: 100,
        }),
      }),
      organization,
      canSelfServe: true,
      contractPeriodEnd: now.add(30, 'days').toString(),
    });

    SubscriptionStore.set(organization.slug, subscription);
    render(
      <SubscriptionHeader organization={organization} subscription={subscription} />
    );
    expect(screen.queryByTestId('partner-plan-ending-banner')).not.toBeInTheDocument();
  });

  it('renders partner plan ending banner for orgs with pending downgrade', function () {
    const organization = OrganizationFixture({
      features: ['usage-log', 'partner-billing-migration'],
      access: ['org:billing'],
    });
    const now = moment();
    const subscription = SubscriptionFixture({
      plan: 'am2_sponsored_team_auf',
      planDetails: PlanFixture({}),
      planTier: 'am2',
      partner: {
        externalId: 'x123x',
        name: 'FOO Org',
        partnership: {
          id: 'FOO',
          displayName: 'FOO',
          supportNote: '',
        },
        isActive: true,
      },
      pendingChanges: PendingChangesFixture({
        plan: 'am3_f',
        planDetails: PlanFixture({
          name: 'Developer',
          price: 0,
        }),
      }),
      organization,
      canSelfServe: true,
      contractPeriodEnd: now.add(30, 'days').toString(),
    });

    SubscriptionStore.set(organization.slug, subscription);
    render(
      <SubscriptionHeader organization={organization} subscription={subscription} />
    );
    expect(screen.getByTestId('partner-plan-ending-banner')).toBeInTheDocument();
  });

  it('renders usage log tab for owners and billing users', function () {
    const organization = OrganizationFixture({
      access: ['org:billing'],
    });
    const sub = SubscriptionFixture({organization});
    render(<SubscriptionHeader organization={organization} subscription={sub} />);

    expect(screen.getByText(/Usage Log/i)).toBeInTheDocument();
  });

  it('renders usage log tab for managers', function () {
    const organization = OrganizationFixture({
      access: ['org:write'],
    });
    const sub = SubscriptionFixture({organization});
    render(<SubscriptionHeader organization={organization} subscription={sub} />);

    expect(screen.getByText(/Usage Log/i)).toBeInTheDocument();
  });

  it('renders usage tab for admin and member users', function () {
    const organization = OrganizationFixture({access: ['org:read']});
    const sub = SubscriptionFixture({organization});

    render(<SubscriptionHeader organization={organization} subscription={sub} />);

    expect(screen.getByText(/Usage Log/i)).toBeInTheDocument();
  });

  it('renders notifications tab for owners and billing users with flag', function () {
    const organization = OrganizationFixture({
      access: ['org:billing'],
    });
    organization.features.push('spend-visibility-notifications');
    const sub = SubscriptionFixture({organization});
    render(<SubscriptionHeader organization={organization} subscription={sub} />);

    expect(screen.getByText(/Notifications/i)).toBeInTheDocument();
  });

  it('does not render notifications tab for owners and billing users without flag', function () {
    const organization = OrganizationFixture({
      access: ['org:billing'],
    });
    const sub = SubscriptionFixture({organization});
    render(<SubscriptionHeader organization={organization} subscription={sub} />);

    expect(screen.queryByText(/Notifications/i)).not.toBeInTheDocument();
  });

  it('does not render Billing Details tab for self serve partner', function () {
    const organization = OrganizationFixture({
      access: ['org:billing'],
    });
    const sub = SubscriptionFixture({
      organization,
      isSelfServePartner: true,
    });
    render(<SubscriptionHeader organization={organization} subscription={sub} />);

    expect(screen.queryByText(/Billing Details/i)).not.toBeInTheDocument();
  });

  it('renders managed note for non-self-serve subscriptions', function () {
    const organization = OrganizationFixture({
      access: ['org:billing'],
    });
    const subscription = SubscriptionFixture({
      organization,
      canSelfServe: false,
    });

    render(
      <SubscriptionHeader organization={organization} subscription={subscription} />
    );
    const managedNote = screen.getByTestId('managed-note');
    expect(managedNote).toBeInTheDocument();
    expect(within(managedNote).getByRole('link')).toHaveAttribute(
      'href',
      'mailto:support@sentry.io'
    );
    expect(managedNote).toHaveTextContent(
      'Contact us at support@sentry.io to make changes to your subscription.'
    );
  });

  it('does not render managed note for self-serve subscriptions', function () {
    const organization = OrganizationFixture({
      access: ['org:billing'],
    });
    const subscription = SubscriptionFixture({
      organization,
      canSelfServe: true,
    });

    render(
      <SubscriptionHeader organization={organization} subscription={subscription} />
    );
    expect(screen.queryByTestId('managed-note')).not.toBeInTheDocument();
  });
});
