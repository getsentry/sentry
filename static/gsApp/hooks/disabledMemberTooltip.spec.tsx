import {OrganizationFixture} from 'sentry-fixture/organization';

import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import DisabledMemberTooltip from 'getsentry/hooks/disabledMemberTooltip';
import SubscriptionStore from 'getsentry/stores/subscriptionStore';

describe('MemberListHeader', function () {
  const organization = OrganizationFixture();

  const sub = SubscriptionFixture({
    organization,
    canTrial: false,
    isTrial: false,
    plan: 'am1_f',
  });
  SubscriptionStore.set(organization.slug, sub);

  it('render basic', async function () {
    render(<DisabledMemberTooltip>Inner text</DisabledMemberTooltip>);

    // Activate the tooltip, check its contents.
    await userEvent.hover(screen.getByText('Inner text'));
    expect(await screen.findByText(/Only 1 member allowed/i)).toBeInTheDocument();
  });
});
