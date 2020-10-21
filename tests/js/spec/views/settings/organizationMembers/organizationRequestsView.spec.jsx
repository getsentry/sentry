import {mountWithTheme} from 'sentry-test/enzyme';
import {selectByValue} from 'sentry-test/select';

import {trackAnalyticsEvent} from 'app/utils/analytics';
import OrganizationRequestsView from 'app/views/settings/organizationMembers/organizationRequestsView';
import OrganizationMembersWrapper from 'app/views/settings/organizationMembers/organizationMembersWrapper';

jest.mock('app/utils/analytics', () => ({
  trackAnalyticsEvent: jest.fn(),
}));

const roles = [
  {
    id: 'admin',
    name: 'Admin',
    desc: 'This is the admin role',
    allowed: true,
  },
  {
    id: 'member',
    name: 'Member',
    desc: 'This is the member role',
    allowed: true,
  },
  {
    id: 'owner',
    name: 'Owner',
    desc: 'This is the owner role',
    allowed: false,
  },
];

describe('OrganizationRequestsView', function () {
  const organization = TestStubs.Organization({
    access: ['member:admin', 'org:admin', 'member:write'],
    status: {
      id: 'active',
    },
  });

  const defaultProps = {
    location: {query: {}},
    params: {orgId: organization.slug},
    router: TestStubs.router(),
  };

  const accessRequest = TestStubs.AccessRequest();
  const inviteRequest = TestStubs.Member({
    id: '123',
    user: null,
    inviteStatus: 'requested_to_be_invited',
    inviter: TestStubs.User(),
    role: 'member',
    teams: [],
  });
  const joinRequest = TestStubs.Member({
    id: '456',
    user: null,
    email: 'test@gmail.com',
    inviteStatus: 'requested_to_join',
    role: 'member',
    teams: [],
  });

  beforeEach(function () {
    trackAnalyticsEvent.mockClear();
    MockApiClient.clearMockResponses();
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
      url: `/organizations/org-slug/access-requests/${accessRequest.id}/`,
      method: 'PUT',
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/members/me/',
      method: 'GET',
      body: {roles},
    });
  });

  it('renders empty', function () {
    const wrapper = mountWithTheme(
      <OrganizationMembersWrapper organization={organization} {...defaultProps}>
        <OrganizationRequestsView organization={organization} {...defaultProps} />
      </OrganizationMembersWrapper>,
      TestStubs.routerContext()
    );

    expect(wrapper.find('PanelHeader').exists()).toBe(true);
    expect(wrapper.find('InviteRequestRow').exists()).toBe(false);
  });

  it('can approve access request and remove', async function () {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/access-requests/',
      method: 'GET',
      body: [accessRequest],
    });

    const org = TestStubs.Organization({
      access: ['team:write'],
      status: {
        id: 'active',
      },
    });

    const wrapper = mountWithTheme(
      <OrganizationMembersWrapper organization={org} {...defaultProps}>
        <OrganizationRequestsView organization={org} {...defaultProps} />
      </OrganizationMembersWrapper>,
      TestStubs.routerContext()
    );

    expect(wrapper.find('NavTabs').exists()).toBe(true);
    expect(wrapper.find('StyledBadge[text="1"]').exists()).toBe(true);
    expect(wrapper.find('OrganizationAccessRequests').exists()).toBe(true);
    expect(
      wrapper
        .find('[data-test-id="request-message"]')
        .text()
        .includes(accessRequest.member.user.name)
    ).toBe(true);
    wrapper.find('button[aria-label="Approve"]').simulate('click');

    await tick();
    wrapper.update();

    expect(wrapper.find('[data-test-id="request-message"]').exists()).toBe(false);
    expect(wrapper.find('NavTabs').exists()).toBe(false);

    expect(trackAnalyticsEvent).not.toHaveBeenCalled();
  });

  it('can deny access request and remove', async function () {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/access-requests/',
      method: 'GET',
      body: [accessRequest],
    });

    const org = TestStubs.Organization({
      access: ['team:write'],
      status: {
        id: 'active',
      },
    });

    const wrapper = mountWithTheme(
      <OrganizationMembersWrapper organization={org} {...defaultProps}>
        <OrganizationRequestsView organization={org} {...defaultProps} />
      </OrganizationMembersWrapper>,
      TestStubs.routerContext()
    );

    expect(wrapper.find('NavTabs').exists()).toBe(true);
    expect(wrapper.find('StyledBadge[text="1"]').exists()).toBe(true);
    expect(wrapper.find('OrganizationAccessRequests').exists()).toBe(true);
    expect(
      wrapper
        .find('[data-test-id="request-message"]')
        .text()
        .includes(accessRequest.member.user.name)
    ).toBe(true);
    wrapper.find('button[aria-label="Deny"]').simulate('click');

    await tick();
    wrapper.update();

    expect(wrapper.find('[data-test-id="request-message"]').exists()).toBe(false);
    expect(wrapper.find('NavTabs').exists()).toBe(false);

    expect(trackAnalyticsEvent).not.toHaveBeenCalled();
  });

  it('does not render invite requests without access', function () {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/invite-requests/',
      method: 'GET',
      body: [inviteRequest],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/access-requests/',
      method: 'GET',
      body: [accessRequest],
    });

    const org = TestStubs.Organization({
      access: [],
      status: {
        id: 'active',
      },
    });

    const wrapper = mountWithTheme(
      <OrganizationMembersWrapper organization={org} {...defaultProps}>
        <OrganizationRequestsView organization={org} {...defaultProps} />
      </OrganizationMembersWrapper>,
      TestStubs.routerContext()
    );

    expect(wrapper.find('NavTabs').exists()).toBe(true);
    expect(wrapper.find('StyledBadge[text="1"]').exists()).toBe(true);
    expect(wrapper.find('InviteRequestRow').exists()).toBe(false);

    expect(trackAnalyticsEvent).not.toHaveBeenCalled();
  });

  it('can approve invite request and update', async function () {
    const org = TestStubs.Organization({
      access: ['member:admin', 'org:admin', 'member:write'],
      status: {
        id: 'active',
      },
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/invite-requests/',
      method: 'GET',
      body: [inviteRequest],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/invite-requests/${inviteRequest.id}/`,
      method: 'PUT',
    });

    const wrapper = mountWithTheme(
      <OrganizationMembersWrapper organization={org} {...defaultProps}>
        <OrganizationRequestsView organization={org} {...defaultProps} />
      </OrganizationMembersWrapper>,
      TestStubs.routerContext()
    );

    expect(wrapper.find('NavTabs').exists()).toBe(true);
    expect(wrapper.find('StyledBadge[text="1"]').exists()).toBe(true);
    expect(wrapper.find('InviteRequestRow').exists()).toBe(true);

    expect(wrapper.find('PanelHeader').text().includes('Pending Invite Requests')).toBe(
      true
    );

    wrapper.find('button[aria-label="Approve"]').simulate('click');
    wrapper.find('button[aria-label="Confirm"]').simulate('click');

    await tick();
    wrapper.update();

    expect(wrapper.find('NavTabs').exists()).toBe(true);
    expect(wrapper.find('StyledBadge').exists()).toBe(false);
    expect(wrapper.find('InviteRequestRow').exists()).toBe(false);

    expect(trackAnalyticsEvent).toHaveBeenCalledWith({
      eventKey: 'invite_request.approved',
      eventName: 'Invite Request Approved',
      organization_id: org.id,
      invite_status: inviteRequest.inviteStatus,
      member_id: parseInt(inviteRequest.id, 10),
    });
  });

  it('can deny invite request and remove', async function () {
    const org = TestStubs.Organization({
      access: ['member:admin', 'org:admin', 'member:write'],
      status: {
        id: 'active',
      },
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/invite-requests/',
      method: 'GET',
      body: [joinRequest],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/invite-requests/${joinRequest.id}/`,
      method: 'DELETE',
    });

    const wrapper = mountWithTheme(
      <OrganizationMembersWrapper organization={org} {...defaultProps}>
        <OrganizationRequestsView organization={org} {...defaultProps} />
      </OrganizationMembersWrapper>,
      TestStubs.routerContext()
    );

    expect(wrapper.find('NavTabs').exists()).toBe(true);
    expect(wrapper.find('StyledBadge[text="1"]').exists()).toBe(true);
    expect(wrapper.find('InviteRequestRow').exists()).toBe(true);

    expect(wrapper.find('PanelHeader').text().includes('Pending Invite Requests')).toBe(
      true
    );

    wrapper.find('button[aria-label="Deny"]').simulate('click');

    await tick();
    wrapper.update();

    expect(wrapper.find('NavTabs').exists()).toBe(true);
    expect(wrapper.find('StyledBadge').exists()).toBe(false);
    expect(wrapper.find('InviteRequestRow').exists()).toBe(false);

    expect(trackAnalyticsEvent).toHaveBeenCalledWith({
      eventKey: 'invite_request.denied',
      eventName: 'Invite Request Denied',
      organization_id: org.id,
      invite_status: joinRequest.inviteStatus,
      member_id: parseInt(joinRequest.id, 10),
    });
  });

  it('can update invite requests', async function () {
    const org = TestStubs.Organization({
      access: ['member:admin', 'org:admin', 'member:write'],
      status: {
        id: 'active',
      },
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/invite-requests/',
      method: 'GET',
      body: [inviteRequest],
    });

    const updateWithApprove = MockApiClient.addMockResponse({
      url: `/organizations/org-slug/invite-requests/${inviteRequest.id}/`,
      method: 'PUT',
    });

    const wrapper = mountWithTheme(
      <OrganizationMembersWrapper organization={org} {...defaultProps}>
        <OrganizationRequestsView organization={org} {...defaultProps} />
      </OrganizationMembersWrapper>,
      TestStubs.routerContext()
    );

    selectByValue(wrapper, 'admin', {name: 'role', control: true});

    wrapper.find('button[aria-label="Approve"]').simulate('click');
    wrapper.find('button[aria-label="Confirm"]').simulate('click');

    await tick();
    wrapper.update();

    expect(updateWithApprove).toHaveBeenCalledWith(
      `/organizations/org-slug/invite-requests/${inviteRequest.id}/`,
      expect.objectContaining({data: expect.objectContaining({role: 'admin'})})
    );
  });
});
