import {MemberFixture} from 'sentry-fixture/member';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {BillingConfigFixture} from 'getsentry-test/fixtures/billingConfig';
import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {act, render, screen} from 'sentry-test/reactTestingLibrary';

import MemberListHeader from 'getsentry/hooks/memberListHeader';
import SubscriptionStore from 'getsentry/stores/subscriptionStore';
import {PlanTier} from 'getsentry/types';

describe('MemberListHeader', function () {
  const organization = OrganizationFixture();

  const disabledMember = MemberFixture({
    flags: {
      'idp:provisioned': false,
      'idp:role-restricted': false,
      'member-limit:restricted': true,
      'sso:invalid': false,
      'sso:linked': false,
      'partnership:restricted': false,
    },
  });
  const enabledMember = MemberFixture({});
  const sub = SubscriptionFixture({
    organization,
    canTrial: false,
    isTrial: false,
    plan: 'am1_f',
  });
  SubscriptionStore.set(organization.slug, sub);

  beforeEach(() => {
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/billing-config/`,
      query: {tier: 'am2'},
      body: BillingConfigFixture(PlanTier.AM2),
    });
  });

  it('show upgrade if disabled member', async function () {
    const members = [disabledMember, enabledMember];

    render(<MemberListHeader organization={organization} members={members} />);

    expect(
      await screen.findByText('Multiple members requires Team Plan or above')
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('member-settings-table-header-upsell-button')
    ).toBeInTheDocument();
  });

  it('do not show upgrade if no disabled member', async function () {
    const members = [enabledMember];

    render(<MemberListHeader organization={organization} members={members} />);

    await act(tick);
    expect(
      screen.queryByTestId('member-settings-table-header-upsell-button')
    ).not.toBeInTheDocument();
  });
});
