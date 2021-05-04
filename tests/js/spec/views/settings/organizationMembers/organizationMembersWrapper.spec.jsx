import {mountWithTheme} from 'sentry-test/enzyme';

import {openInviteMembersModal} from 'app/actionCreators/modal';
import {trackAnalyticsEvent} from 'app/utils/analytics';
import OrganizationMembersList from 'app/views/settings/organizationMembers/organizationMembersList';
import OrganizationMembersWrapper from 'app/views/settings/organizationMembers/organizationMembersWrapper';

jest.mock('app/utils/analytics', () => ({
  trackAnalyticsEvent: jest.fn(),
  metric: {mark: jest.fn()},
}));
jest.mock('app/actionCreators/modal', () => ({
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

  const inviteRequest = TestStubs.Member({
    user: null,
    inviterName: TestStubs.User().name,
    inviteStatus: 'requested_to_be_invited',
  });

  const joinRequest = TestStubs.Member({
    user: null,
    inviteStatus: 'requested_to_join',
  });

  beforeEach(function () {
    trackAnalyticsEvent.mockClear();
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

  it('does not render requests tab without access', function () {
    const org = TestStubs.Organization({
      access: [],
      status: {
        id: 'active',
      },
    });

    const wrapper = mountWithTheme(
      <OrganizationMembersWrapper organization={org} {...defaultProps} />,
      TestStubs.routerContext()
    );

    expect(wrapper.find('NavTabs').exists()).toBe(false);
    expect(trackAnalyticsEvent).not.toHaveBeenCalled();
  });

  it('renders requests tab with access', function () {
    const org = TestStubs.Organization({
      access: ['member:admin', 'org:admin', 'member:write'],
      status: {
        id: 'active',
      },
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/invite-requests/',
      method: 'GET',
      body: [inviteRequest, joinRequest],
    });

    const wrapper = mountWithTheme(
      <OrganizationMembersWrapper organization={org} {...defaultProps} />,
      TestStubs.routerContext()
    );

    expect(wrapper.find('NavTabs').exists()).toBe(true);
    expect(wrapper.find('StyledBadge[text="2"]').exists()).toBe(true);
    expect(wrapper.find('ListLink[data-test-id="members-tab"]').exists()).toBe(true);
    expect(wrapper.find('ListLink[data-test-id="requests-tab"]').exists()).toBe(true);

    wrapper.find('a[data-test-id="requests-tab"]').simulate('click');
    expect(trackAnalyticsEvent).toHaveBeenCalledWith({
      eventKey: 'invite_request.tab_clicked',
      eventName: 'Invite Request Tab Clicked',
      organization_id: org.id,
    });
  });

  it('renders requests tab with access and no invite requests', function () {
    const org = TestStubs.Organization({
      access: ['member:admin', 'org:admin', 'member:write'],
      status: {
        id: 'active',
      },
    });

    const wrapper = mountWithTheme(
      <OrganizationMembersWrapper organization={org} {...defaultProps} />,
      TestStubs.routerContext()
    );

    expect(wrapper.find('NavTabs').exists()).toBe(true);
    expect(wrapper.find('StyledBadge').exists()).toBe(false);
    expect(wrapper.find('ListLink[data-test-id="members-tab"]').exists()).toBe(true);
    expect(wrapper.find('ListLink[data-test-id="requests-tab"]').exists()).toBe(true);
  });

  it('renders requests tab with team requests', function () {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/access-requests/',
      method: 'GET',
      body: [TestStubs.AccessRequest()],
    });

    const wrapper = mountWithTheme(
      <OrganizationMembersWrapper organization={organization} {...defaultProps} />,
      TestStubs.routerContext()
    );

    expect(wrapper.find('NavTabs').exists()).toBe(true);
    expect(wrapper.find('ListLink[data-test-id="members-tab"]').exists()).toBe(true);
    expect(wrapper.find('ListLink[data-test-id="requests-tab"]').exists()).toBe(true);

    expect(trackAnalyticsEvent).not.toHaveBeenCalled();
  });

  it('renders requests tab with team requests and no access', function () {
    const org = TestStubs.Organization({
      access: [],
      status: {
        id: 'active',
      },
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/access-requests/',
      method: 'GET',
      body: [TestStubs.AccessRequest()],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/invite-requests/',
      method: 'GET',
      body: [inviteRequest, joinRequest],
    });

    const wrapper = mountWithTheme(
      <OrganizationMembersWrapper organization={org} {...defaultProps} />,
      TestStubs.routerContext()
    );

    expect(wrapper.find('NavTabs').exists()).toBe(true);
    expect(wrapper.find('StyledBadge[text="1"]').exists()).toBe(true);
    expect(wrapper.find('ListLink[data-test-id="members-tab"]').exists()).toBe(true);
    expect(wrapper.find('ListLink[data-test-id="requests-tab"]').exists()).toBe(true);

    expect(trackAnalyticsEvent).not.toHaveBeenCalled();
  });

  it('can invite member', function () {
    const wrapper = mountWithTheme(
      <OrganizationMembersWrapper organization={organization} {...defaultProps} />,
      TestStubs.routerContext()
    );

    const inviteButton = wrapper.find('StyledLink');
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
      <OrganizationMembersWrapper organization={org} {...defaultProps} />,
      TestStubs.routerContext()
    );

    const inviteButton = wrapper.find('StyledLink');
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
      </OrganizationMembersWrapper>,
      TestStubs.routerContext()
    );

    expect(wrapper.find('OrganizationMembersList').exists()).toBe(true);
    expect(wrapper.find('PanelHeader').text().includes('Members')).toBe(true);

    expect(wrapper.find('StyledPanelItem').text().includes(member.name)).toBe(true);
  });
});
