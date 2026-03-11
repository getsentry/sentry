import {OrganizationFixture} from 'sentry-fixture/organization';

import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import DisabledMemberView from 'getsentry/hooks/disabledMemberView';
import SubscriptionStore from 'getsentry/stores/subscriptionStore';

describe('DisabledMemberView', () => {
  it('click triggers request member', async () => {
    const {routerProps} = initializeOrg();
    const organization = OrganizationFixture();
    const sub = SubscriptionFixture({organization});
    SubscriptionStore.set(organization.slug, sub);

    MockApiClient.addMockResponse({
      url: `/customers/org-slug/`,
      body: sub,
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/`,
      method: 'GET',
      query: {
        detailed: '0',
        include_feature_flags: '1',
      },
      body: organization,
    });

    const requestMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/plan-upgrade-request/`,
      method: 'POST',
    });

    render(<DisabledMemberView {...routerProps} params={{orgId: organization.slug}} />);

    await screen.findByText('Request Upgrade');
    await userEvent.click(screen.getByText('Request Upgrade'));
    expect(requestMock).toHaveBeenCalled();
  });
});
