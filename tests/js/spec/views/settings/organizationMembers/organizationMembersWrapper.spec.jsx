import React from 'react';
import {mountWithTheme} from 'sentry-test/enzyme';

import {openInviteMembersModal} from 'app/actionCreators/modal';
import OrganizationMembers from 'app/views/settings/organizationMembers';
import OrganizationMembersWrapper from 'app/views/settings/organizationMembers/organizationMembersWrapper';

jest.mock('app/actionCreators/modal', () => ({
  openInviteMembersModal: jest.fn(),
}));

describe('OrganizationMembersWrapper', function() {
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

  beforeEach(function() {
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

  it('renders', function() {
    const wrapper = mountWithTheme(
      <OrganizationMembersWrapper {...defaultProps} />,
      TestStubs.routerContext([{organization}])
    );

    expect(wrapper.find('NavTabs').exists()).toBe(false);
  });

  it('renders requests tab with InviteRequestExperiment', function() {
    const org = TestStubs.Organization({
      experiments: {InviteRequestExperiment: 1},
      access: ['member:admin', 'org:admin', 'member:write'],
      status: {
        id: 'active',
      },
    });

    const wrapper = mountWithTheme(
      <OrganizationMembersWrapper {...defaultProps} />,
      TestStubs.routerContext([{organization: org}])
    );

    expect(wrapper.find('NavTabs').exists()).toBe(true);
    expect(wrapper.find('ListLink[data-test-id="members-tab"]').exists()).toBe(true);
    expect(wrapper.find('ListLink[data-test-id="requests-tab"]').exists()).toBe(true);
  });

  it('renders requests tab with JoinRequestExperiment', function() {
    const org = TestStubs.Organization({
      experiments: {JoinRequestExperiment: 1},
      access: ['member:admin', 'org:admin', 'member:write'],
      status: {
        id: 'active',
      },
    });

    const wrapper = mountWithTheme(
      <OrganizationMembersWrapper {...defaultProps} />,
      TestStubs.routerContext([{organization: org}])
    );

    expect(wrapper.find('NavTabs').exists()).toBe(true);
    expect(wrapper.find('ListLink[data-test-id="members-tab"]').exists()).toBe(true);
    expect(wrapper.find('ListLink[data-test-id="requests-tab"]').exists()).toBe(true);
  });

  it('renders requests tab with team requests', function() {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/access-requests/',
      method: 'GET',
      body: [TestStubs.AccessRequest()],
    });

    const wrapper = mountWithTheme(
      <OrganizationMembersWrapper {...defaultProps} />,
      TestStubs.routerContext([{organization}])
    );

    expect(wrapper.find('NavTabs').exists()).toBe(true);
    expect(wrapper.find('ListLink[data-test-id="members-tab"]').exists()).toBe(true);
    expect(wrapper.find('ListLink[data-test-id="requests-tab"]').exists()).toBe(true);
  });

  it('can invite member', function() {
    const wrapper = mountWithTheme(
      <OrganizationMembersWrapper {...defaultProps} />,
      TestStubs.routerContext([{organization}])
    );

    const inviteButton = wrapper.find('StyledButton[aria-label="Invite Members"]');
    expect(inviteButton.prop('disabled')).toBe(false);
    inviteButton.simulate('click');

    expect(openInviteMembersModal).toHaveBeenCalled();
  });

  it('renders member list', function() {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/members/',
      method: 'GET',
      body: [member],
    });
    const wrapper = mountWithTheme(
      <OrganizationMembersWrapper {...defaultProps}>
        <OrganizationMembers {...defaultProps} />
      </OrganizationMembersWrapper>,
      TestStubs.routerContext([{organization}])
    );

    expect(wrapper.find('OrganizationMembersView').exists()).toBe(true);
    expect(
      wrapper
        .find('PanelHeader')
        .text()
        .includes('Members')
    ).toBe(true);

    expect(
      wrapper
        .find('PanelItem')
        .text()
        .includes(member.name)
    ).toBe(true);
  });
});
