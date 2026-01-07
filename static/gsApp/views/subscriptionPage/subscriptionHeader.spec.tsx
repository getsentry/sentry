import moment from 'moment-timezone';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {BillingConfigFixture} from 'getsentry-test/fixtures/billingConfig';
import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {render, screen, within} from 'sentry-test/reactTestingLibrary';

import type {Organization} from 'sentry/types/organization';

import {PendingChangesFixture} from 'getsentry/__fixtures__/pendingChanges';
import {PlanFixture} from 'getsentry/__fixtures__/plan';
import SubscriptionStore from 'getsentry/stores/subscriptionStore';
import {PlanTier} from 'getsentry/types';
import SubscriptionHeader from 'getsentry/views/subscriptionPage/subscriptionHeader';

describe('SubscriptionHeader', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: `/customers/org-slug/billing-config/`,
      method: 'GET',
      body: BillingConfigFixture(PlanTier.AM1),
    });
    MockApiClient.addMockResponse({
      url: `/customers/org-slug/billing-details/`,
      method: 'GET',
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
    MockApiClient.addMockResponse({
      url: `/customers/org-slug/subscription/next-bill/`,
      method: 'GET',
    });
  });

  async function assertNewHeaderCards({
    organization,
    hasNextBillCard,
    hasBillingInfoCard,
    hasPaygCard,
  }: {
    hasBillingInfoCard: boolean;
    hasNextBillCard: boolean;
    hasPaygCard: boolean;
    organization: Organization;
  }) {
    const hasBillingPerms = organization.access?.includes('org:billing');
    await screen.findByRole('heading', {name: 'Subscription'});

    if (hasNextBillCard) {
      await screen.findByRole('heading', {name: 'Next bill'});
    } else {
      expect(screen.queryByRole('heading', {name: 'Next bill'})).not.toBeInTheDocument();
    }

    if (hasBillingInfoCard) {
      await screen.findByRole('heading', {name: 'Billing information'});
      screen.getByRole('button', {name: 'Edit billing information'});
    } else {
      expect(
        screen.queryByRole('heading', {name: 'Billing information'})
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', {name: 'Edit billing information'})
      ).not.toBeInTheDocument();
    }

    if (hasPaygCard) {
      await screen.findByRole('heading', {name: 'Pay-as-you-go'});

      if (hasBillingPerms) {
        expect(screen.getByRole('button', {name: 'Set limit'})).toBeInTheDocument();
      } else {
        expect(screen.queryByRole('button', {name: 'Set limit'})).not.toBeInTheDocument();
        expect(
          screen.queryByRole('button', {name: 'Edit limit'})
        ).not.toBeInTheDocument();
      }
    } else {
      expect(
        screen.queryByRole('heading', {name: 'Pay-as-you-go'})
      ).not.toBeInTheDocument();
      expect(screen.queryByRole('button', {name: 'Set limit'})).not.toBeInTheDocument();
    }

    // all subscriptions have links card
    if (hasBillingPerms) {
      expect(
        screen.getByRole('heading', {name: 'Receipts & notifications'})
      ).toBeInTheDocument();
    } else {
      // users without billing perms only see activity log
      expect(screen.getByRole('heading', {name: 'Activity log'})).toBeInTheDocument();

      // assertions for args to catch user errors :)
      expect(hasNextBillCard).toBe(false);
      expect(hasBillingInfoCard).toBe(false);
    }
  }

  it('renders header cards and manage plan button for self-serve free customers', async () => {
    const organization = OrganizationFixture({
      access: ['org:billing'],
    });
    const subscription = SubscriptionFixture({
      organization,
      plan: 'am3_f',
    });
    SubscriptionStore.set(organization.slug, subscription);
    render(
      <SubscriptionHeader organization={organization} subscription={subscription} />
    );
    await assertNewHeaderCards({
      organization,
      hasNextBillCard: false,
      hasBillingInfoCard: true,
      hasPaygCard: false,
    });
    expect(screen.getByRole('button', {name: 'Manage plan'})).toBeInTheDocument();
  });

  it('renders header cards and manage plan button for self-serve paid customers', async () => {
    const organization = OrganizationFixture({
      access: ['org:billing'],
    });
    const subscription = SubscriptionFixture({
      organization,
      plan: 'am3_team',
    });
    SubscriptionStore.set(organization.slug, subscription);
    render(
      <SubscriptionHeader organization={organization} subscription={subscription} />
    );
    await assertNewHeaderCards({
      organization,
      hasNextBillCard: true,
      hasBillingInfoCard: true,
      hasPaygCard: true,
    });
    expect(screen.getByRole('button', {name: 'Manage plan'})).toBeInTheDocument();
  });

  it('renders header cards and manage plan button for self-serve free partner customers', async () => {
    const organization = OrganizationFixture({
      access: ['org:billing'],
    });
    const subscription = SubscriptionFixture({
      organization,
      plan: 'am3_f',
      isSelfServePartner: true,
    });
    SubscriptionStore.set(organization.slug, subscription);
    render(
      <SubscriptionHeader organization={organization} subscription={subscription} />
    );
    await assertNewHeaderCards({
      organization,
      hasNextBillCard: false,
      hasBillingInfoCard: false,
      hasPaygCard: false,
    });
    expect(screen.getByRole('button', {name: 'Manage plan'})).toBeInTheDocument();
  });

  it('renders header cards and manage plan button for self-serve paid partner customers', async () => {
    const organization = OrganizationFixture({
      access: ['org:billing'],
    });
    const subscription = SubscriptionFixture({
      organization,
      plan: 'am3_team',
      isSelfServePartner: true,
    });
    SubscriptionStore.set(organization.slug, subscription);
    render(
      <SubscriptionHeader organization={organization} subscription={subscription} />
    );
    await assertNewHeaderCards({
      organization,
      hasNextBillCard: true,
      hasBillingInfoCard: false,
      hasPaygCard: true,
    });
    expect(screen.getByRole('button', {name: 'Manage plan'})).toBeInTheDocument();
  });

  it('hides manage plan button and renders header cards for managed customers', async () => {
    const organization = OrganizationFixture({
      access: ['org:billing'],
    });
    const subscription = SubscriptionFixture({
      organization,
      plan: 'am3_business_ent_auf',
      canSelfServe: false,
      supportsOnDemand: false,
    });
    SubscriptionStore.set(organization.slug, subscription);
    render(
      <SubscriptionHeader organization={organization} subscription={subscription} />
    );
    await assertNewHeaderCards({
      organization,
      hasNextBillCard: false,
      hasBillingInfoCard: false,
      hasPaygCard: false,
    });
    expect(screen.queryByRole('button', {name: 'Manage plan'})).not.toBeInTheDocument();
  });

  it('hides manage plan button and renders header cards for managed customers with OD supported', async () => {
    const organization = OrganizationFixture({
      access: ['org:billing'],
    });
    const subscription = SubscriptionFixture({
      organization,
      plan: 'am3_business_ent_auf',
      canSelfServe: false,
      supportsOnDemand: true,
    });
    SubscriptionStore.set(organization.slug, subscription);
    render(
      <SubscriptionHeader organization={organization} subscription={subscription} />
    );
    await assertNewHeaderCards({
      organization,
      hasNextBillCard: false,
      hasBillingInfoCard: true,
      hasPaygCard: true,
    });
    expect(screen.queryByRole('button', {name: 'Manage plan'})).not.toBeInTheDocument();
  });

  it('hides manage plan button and renders header cards for self-serve free customers and user without billing perms', async () => {
    const organization = OrganizationFixture({});
    const subscription = SubscriptionFixture({
      organization,
      plan: 'am3_f',
    });
    SubscriptionStore.set(organization.slug, subscription);
    render(
      <SubscriptionHeader organization={organization} subscription={subscription} />
    );
    await assertNewHeaderCards({
      organization,
      hasNextBillCard: false,
      hasBillingInfoCard: false,
      hasPaygCard: false,
    });
    expect(screen.queryByRole('button', {name: 'Manage plan'})).not.toBeInTheDocument();
  });

  it('hides manage plan button and renders header cards for self-serve paid customers and user without billing perms', async () => {
    const organization = OrganizationFixture({});
    const subscription = SubscriptionFixture({
      organization,
      plan: 'am3_team',
    });
    SubscriptionStore.set(organization.slug, subscription);
    render(
      <SubscriptionHeader organization={organization} subscription={subscription} />
    );
    await assertNewHeaderCards({
      organization,
      hasNextBillCard: false,
      hasBillingInfoCard: false,
      hasPaygCard: true,
    });
    expect(screen.queryByRole('button', {name: 'Manage plan'})).not.toBeInTheDocument();
  });

  it('renders header cards, manage plan button, and trial alert for self-serve customers on subscription trial', async () => {
    const organization = OrganizationFixture({
      access: ['org:billing'],
    });
    const subscription = SubscriptionFixture({
      organization,
      plan: 'am3_t',
    });
    SubscriptionStore.set(organization.slug, subscription);
    render(
      <SubscriptionHeader organization={organization} subscription={subscription} />
    );
    await assertNewHeaderCards({
      organization,
      hasNextBillCard: false,
      hasBillingInfoCard: true,
      hasPaygCard: false,
    });
    expect(screen.getByRole('button', {name: 'Manage plan'})).toBeInTheDocument();
    expect(screen.getByTestId('trial-alert')).toBeInTheDocument();
  });

  it('renders header cards and manage plan button for self-serve paid customers on plan trial', async () => {
    const organization = OrganizationFixture({
      access: ['org:billing'],
    });
    const subscription = SubscriptionFixture({
      organization,
      plan: 'am3_team',
      isTrial: true,
    });
    SubscriptionStore.set(organization.slug, subscription);
    render(
      <SubscriptionHeader organization={organization} subscription={subscription} />
    );
    await assertNewHeaderCards({
      organization,
      hasNextBillCard: true,
      hasBillingInfoCard: true,
      hasPaygCard: true,
    });
    expect(screen.getByRole('button', {name: 'Manage plan'})).toBeInTheDocument();
  });

  it('renders header cards for customers on subscription enterprise trial', async () => {
    const organization = OrganizationFixture({
      access: ['org:billing'],
    });
    const subscription = SubscriptionFixture({
      organization,
      plan: 'am3_t_ent',
    });
    SubscriptionStore.set(organization.slug, subscription);
    render(
      <SubscriptionHeader organization={organization} subscription={subscription} />
    );
    await assertNewHeaderCards({
      organization,
      hasNextBillCard: false,
      hasBillingInfoCard: false,
      hasPaygCard: false,
    });
  });

  it('does not render new payment failure alert for past due subscriptions without flag', async () => {
    const organization = OrganizationFixture({
      access: ['org:billing'],
    });
    const subscription = SubscriptionFixture({
      organization,
      plan: 'am3_team',
      isPastDue: true,
    });
    SubscriptionStore.set(organization.slug, subscription);
    render(
      <SubscriptionHeader organization={organization} subscription={subscription} />
    );
    await screen.findByText('Subscription');
    expect(
      screen.queryByText(
        'Automatic payment failed. Update your payment method to ensure uninterrupted access to Sentry.'
      )
    ).not.toBeInTheDocument();
  });

  it('renders partner plan ending banner for partner orgs with flag and ending contract', () => {
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
      contractPeriodEnd: now.add(30, 'days').toISOString(),
    });

    SubscriptionStore.set(organization.slug, subscription);
    render(
      <SubscriptionHeader organization={organization} subscription={subscription} />
    );
    expect(screen.getByTestId('partner-plan-ending-banner')).toBeInTheDocument();
  });

  it('does not render partner plan ending banner for partner orgs with flag and ending contract greater than 30 days', () => {
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
      contractPeriodEnd: now.add(50, 'days').toISOString(),
    });

    SubscriptionStore.set(organization.slug, subscription);
    render(
      <SubscriptionHeader organization={organization} subscription={subscription} />
    );
    expect(screen.queryByTestId('partner-plan-ending-banner')).not.toBeInTheDocument();
  });

  it('does not render partner plan ending banner for orgs with pending upgrade', () => {
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
      contractPeriodEnd: now.add(30, 'days').toISOString(),
    });

    SubscriptionStore.set(organization.slug, subscription);
    render(
      <SubscriptionHeader organization={organization} subscription={subscription} />
    );
    expect(screen.queryByTestId('partner-plan-ending-banner')).not.toBeInTheDocument();
  });

  it('renders partner plan ending banner for orgs with pending downgrade', () => {
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
      contractPeriodEnd: now.add(30, 'days').toISOString(),
    });

    SubscriptionStore.set(organization.slug, subscription);
    render(
      <SubscriptionHeader organization={organization} subscription={subscription} />
    );
    expect(screen.getByTestId('partner-plan-ending-banner')).toBeInTheDocument();
  });

  it('renders managed note for non-self-serve subscriptions', () => {
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

  it('does not render managed note for self-serve subscriptions', () => {
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

  it('does not render trial alert when not on trial', () => {
    const organization = OrganizationFixture({
      access: ['org:billing'],
    });
    const subscription = SubscriptionFixture({
      organization,
    });
    render(
      <SubscriptionHeader organization={organization} subscription={subscription} />
    );
    expect(screen.queryByTestId('trial-alert')).not.toBeInTheDocument();
  });
});
