import {MemberFixture} from 'sentry-fixture/member';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {PlanFixture} from 'getsentry/__fixtures__/plan';
import PartnerPlanEndingModal from 'getsentry/components/partnerPlanEndingModal';
import SubscriptionStore from 'getsentry/stores/subscriptionStore';
import {PlanName} from 'getsentry/types';

describe('PartnerPlanEndingModal', function () {
  beforeEach(() => {
    jest.spyOn(Date, 'now').mockImplementation(() => new Date('2024-08-01').getTime());

    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/members/`,
      method: 'GET',
      body: [
        MemberFixture({
          email: 'admin@example.com',
        }),
      ],
    });
  });

  it('shows request upgrade when user does not have billing permissions', async function () {
    const org = OrganizationFixture({access: []});
    const sub = SubscriptionFixture({organization: org, contractPeriodEnd: '2024-08-08'});
    SubscriptionStore.set(org.slug, sub);

    const mockCall = MockApiClient.addMockResponse({
      url: `/organizations/org-slug/partner-migration-request/?referrer=partner_plan_ending_modal`,
      method: 'POST',
    });

    render(
      <PartnerPlanEndingModal
        closeModal={jest.fn()}
        organization={org}
        subscription={sub}
      />
    );

    expect(screen.getByTestId('partner-plan-ending-modal')).toBeInTheDocument();
    expect(screen.getByLabelText('Request to Upgrade')).toBeInTheDocument();
    await userEvent.click(screen.getByLabelText('Request to Upgrade'));
    expect(mockCall).toHaveBeenCalled();
  });

  it('shows an upgrade now button with billing permission', function () {
    const org = OrganizationFixture({access: ['org:billing']});
    const sub = SubscriptionFixture({organization: org, contractPeriodEnd: '2024-08-08'});
    SubscriptionStore.set(org.slug, sub);

    render(
      <PartnerPlanEndingModal
        closeModal={jest.fn()}
        organization={org}
        subscription={sub}
      />
    );

    expect(screen.getByTestId('partner-plan-ending-modal')).toBeInTheDocument();
    expect(screen.getByLabelText('Upgrade Now')).toBeInTheDocument();
  });

  it('displays 7 days left', function () {
    const org = OrganizationFixture({access: ['org:billing']});
    const sub = SubscriptionFixture({organization: org, contractPeriodEnd: '2024-08-08'});
    SubscriptionStore.set(org.slug, sub);

    render(
      <PartnerPlanEndingModal
        closeModal={jest.fn()}
        organization={org}
        subscription={sub}
      />
    );

    expect(screen.getByTestId('partner-plan-ending-modal')).toBeInTheDocument();
    expect(screen.getByText('7 days left')).toBeInTheDocument();
    expect(screen.getByText('New Plan on Aug 9, 2024')).toBeInTheDocument();
  });

  it('displays 1 day left', function () {
    const org = OrganizationFixture({access: ['org:billing']});
    const sub = SubscriptionFixture({organization: org, contractPeriodEnd: '2024-08-02'});
    SubscriptionStore.set(org.slug, sub);

    render(
      <PartnerPlanEndingModal
        closeModal={jest.fn()}
        organization={org}
        subscription={sub}
      />
    );

    expect(screen.getByText('1 day left')).toBeInTheDocument();
    expect(screen.getByText('New Plan on Aug 3, 2024')).toBeInTheDocument();
  });

  it('displays team related content', function () {
    const org = OrganizationFixture({access: ['org:billing']});
    const sub = SubscriptionFixture({
      organization: org,
      contractPeriodEnd: '2024-08-30',
      planDetails: PlanFixture({
        name: PlanName.TEAM_SPONSORED,
      }),
    });
    SubscriptionStore.set(org.slug, sub);

    render(
      <PartnerPlanEndingModal
        closeModal={jest.fn()}
        organization={org}
        subscription={sub}
      />
    );
    expect(screen.queryAllByText('Business')).toHaveLength(0);
    expect(screen.getByText('Team')).toBeInTheDocument();
  });

  it('displays business related content', function () {
    const org = OrganizationFixture({access: ['org:billing']});
    const sub = SubscriptionFixture({
      organization: org,
      contractPeriodEnd: '2024-08-30',
      planDetails: PlanFixture({
        name: PlanName.BUSINESS_SPONSORED,
      }),
    });
    SubscriptionStore.set(org.slug, sub);

    render(
      <PartnerPlanEndingModal
        closeModal={jest.fn()}
        organization={org}
        subscription={sub}
      />
    );
    expect(screen.queryAllByText('Team')).toHaveLength(0);
    expect(screen.getByText('Business')).toBeInTheDocument();
  });

  it('does not display if plan ended', function () {
    const org = OrganizationFixture({access: ['org:billing']});
    const sub = SubscriptionFixture({organization: org, contractPeriodEnd: '2024-07-31'});
    SubscriptionStore.set(org.slug, sub);

    render(
      <PartnerPlanEndingModal
        closeModal={jest.fn()}
        organization={org}
        subscription={sub}
      />
    );

    expect(screen.queryByTestId('partner-plan-ending-modal')).not.toBeInTheDocument();
  });
});
