import {mountWithTheme} from 'sentry-test/enzyme';

import {openInviteMembersModal} from 'sentry/actionCreators/modal';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import OrganizationMembersList from 'sentry/views/settings/organizationMembers/organizationMembersList';
import OrganizationMembersWrapper from 'sentry/views/settings/organizationMembers/organizationMembersWrapper';

jest.mock('sentry/utils/analytics/trackAdvancedAnalyticsEvent', () => jest.fn());
jest.mock('sentry/actionCreators/modal', () => ({
  openInviteMembersModal: jest.fn(),
}));

describe('OrganizationMembersWrapper', function () {
  const member = TestStubs.Member();
  const organization = TestStubs.Organization({
    access: ['member:admin', 'org:admin', 'member:write'],
    status: {
      id: 'active',
    },
  });

  const defaultProps = {
    location: {query: {}},
    params: {orgId: organization.slug},
  };

  beforeEach(function () {
    trackAdvancedAnalyticsEvent.mockClear();
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/members/me/',
      method: 'GET',
      body: {roles: []},
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/invite-requests/',
      method: 'GET',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/access-requests/',
      method: 'GET',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/members/',
      method: 'GET',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/auth-provider/',
      method: 'GET',
      body: {},
    });
  });

  it('can invite member', function () {
    const wrapper = mountWithTheme(
      <OrganizationMembersWrapper organization={organization} {...defaultProps} />
    );

    const inviteButton = wrapper.find('StyledButton');
    inviteButton.simulate('click');

    expect(openInviteMembersModal).toHaveBeenCalled();
  });

  it('can invite without permissions', function () {
    const org = TestStubs.Organization({
      access: [],
      status: {
        id: 'active',
      },
    });

    const wrapper = mountWithTheme(
      <OrganizationMembersWrapper organization={org} {...defaultProps} />
    );

    const inviteButton = wrapper.find('StyledButton');
    inviteButton.simulate('click');

    expect(openInviteMembersModal).toHaveBeenCalled();
  });

  it('renders member list', function () {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/members/',
      method: 'GET',
      body: [member],
    });
    const wrapper = mountWithTheme(
      <OrganizationMembersWrapper organization={organization} {...defaultProps}>
        <OrganizationMembersList {...defaultProps} router={{routes: []}} />
      </OrganizationMembersWrapper>
    );

    expect(wrapper.find('OrganizationMembersList').exists()).toBe(true);
    expect(wrapper.find('PanelHeader').text().includes('Members')).toBe(true);

    expect(wrapper.find('StyledPanelItem').text().includes(member.name)).toBe(true);
  });
});
