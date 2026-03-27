import moment from 'moment-timezone';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {PlanFixture} from 'getsentry/__fixtures__/plan';
import {PartnerPlanEndingBanner} from 'getsentry/components/partnerPlanEndingBanner';
import {trackGetsentryAnalytics} from 'getsentry/utils/trackGetsentryAnalytics';

jest.mock('getsentry/utils/trackGetsentryAnalytics');

function createPartnerSubscription(
  organization: ReturnType<typeof OrganizationFixture>,
  overrides: Record<string, unknown> = {}
) {
  return SubscriptionFixture({
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
    contractPeriodEnd: moment().add(15, 'days').toISOString(),
    ...overrides,
  });
}

describe('PartnerPlanEndingBanner', () => {
  it('renders the banner for a partner org with migration feature and ending contract', () => {
    const organization = OrganizationFixture({
      features: ['partner-billing-migration'],
    });
    const subscription = createPartnerSubscription(organization);

    render(
      <PartnerPlanEndingBanner organization={organization} subscription={subscription} />
    );

    expect(screen.getByTestId('partner-plan-ending-banner')).toBeInTheDocument();
    expect(
      screen.getByText('Your current promotional plan is ending')
    ).toBeInTheDocument();
    expect(screen.getByText(/15 days left/)).toBeInTheDocument();
  });

  it('shows the upgrade button linking to checkout', () => {
    const organization = OrganizationFixture({
      features: ['partner-billing-migration'],
    });
    const subscription = createPartnerSubscription(organization);

    render(
      <PartnerPlanEndingBanner organization={organization} subscription={subscription} />
    );

    const upgradeButton = screen.getByRole('button', {name: 'Upgrade to a Paid Plan'});
    expect(upgradeButton).toBeInTheDocument();
    expect(upgradeButton.closest('a')).toHaveAttribute(
      'href',
      `/checkout/${organization.slug}/?referrer=partner_plan_ending_banner`
    );
  });

  it('displays the partner name in the body text', () => {
    const organization = OrganizationFixture({
      features: ['partner-billing-migration'],
    });
    const subscription = createPartnerSubscription(organization, {
      partner: {
        externalId: 'x123x',
        name: 'Vercel Org',
        partnership: {
          id: 'vercel',
          displayName: 'Vercel',
          supportNote: '',
        },
        isActive: true,
      },
    });

    render(
      <PartnerPlanEndingBanner organization={organization} subscription={subscription} />
    );

    expect(screen.getByText(/Vercel/)).toBeInTheDocument();
  });

  it('displays singular day when 1 day left', () => {
    const organization = OrganizationFixture({
      features: ['partner-billing-migration'],
    });
    const now = moment();
    const subscription = createPartnerSubscription(organization, {
      contractPeriodEnd: now.add(1, 'day').toISOString(),
    });

    render(
      <PartnerPlanEndingBanner organization={organization} subscription={subscription} />
    );

    expect(screen.getByText(/1 day left/)).toBeInTheDocument();
  });

  it('fires analytics when upgrade button is clicked', async () => {
    const organization = OrganizationFixture({
      features: ['partner-billing-migration'],
    });
    const subscription = createPartnerSubscription(organization);

    render(
      <PartnerPlanEndingBanner organization={organization} subscription={subscription} />
    );

    await userEvent.click(screen.getByRole('button', {name: 'Upgrade to a Paid Plan'}));
    expect(trackGetsentryAnalytics).toHaveBeenCalledWith(
      'partner_billing_migration.banner.clicked_cta',
      expect.objectContaining({
        subscription,
        organization,
        partner: 'FOO',
      })
    );
  });

  it('does not render when partner is missing', () => {
    const organization = OrganizationFixture({
      features: ['partner-billing-migration'],
    });
    const subscription = SubscriptionFixture({
      organization,
      partner: null,
      contractPeriodEnd: moment().add(15, 'days').toISOString(),
    });

    render(
      <PartnerPlanEndingBanner organization={organization} subscription={subscription} />
    );

    expect(screen.queryByTestId('partner-plan-ending-banner')).not.toBeInTheDocument();
  });

  it('does not render without the partner-billing-migration feature', () => {
    const organization = OrganizationFixture({features: []});
    const subscription = createPartnerSubscription(organization);

    render(
      <PartnerPlanEndingBanner organization={organization} subscription={subscription} />
    );

    expect(screen.queryByTestId('partner-plan-ending-banner')).not.toBeInTheDocument();
  });

  it('does not render when contract end is more than 30 days away', () => {
    const organization = OrganizationFixture({
      features: ['partner-billing-migration'],
    });
    const subscription = createPartnerSubscription(organization, {
      contractPeriodEnd: moment().add(31, 'days').toISOString(),
    });

    render(
      <PartnerPlanEndingBanner organization={organization} subscription={subscription} />
    );

    expect(screen.queryByTestId('partner-plan-ending-banner')).not.toBeInTheDocument();
  });

  it('does not render when contract has already ended', () => {
    const organization = OrganizationFixture({
      features: ['partner-billing-migration'],
    });
    const subscription = createPartnerSubscription(organization, {
      contractPeriodEnd: moment().subtract(1, 'day').toISOString(),
    });

    render(
      <PartnerPlanEndingBanner organization={organization} subscription={subscription} />
    );

    expect(screen.queryByTestId('partner-plan-ending-banner')).not.toBeInTheDocument();
  });

  it('does not render when there is a pending upgrade', () => {
    const organization = OrganizationFixture({
      features: ['partner-billing-migration'],
    });
    const subscription = createPartnerSubscription(organization, {
      pendingChanges: {
        planDetails: {price: 100},
      },
    });

    render(
      <PartnerPlanEndingBanner organization={organization} subscription={subscription} />
    );

    expect(screen.queryByTestId('partner-plan-ending-banner')).not.toBeInTheDocument();
  });
});
