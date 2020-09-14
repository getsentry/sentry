import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';

import {Client} from 'app/api';
import {
  openInviteMembersModal,
  openTeamAccessRequestModal,
} from 'app/actionCreators/modal';
import TeamMembers from 'app/views/settings/organizationTeams/teamMembers';

jest.mock('app/actionCreators/modal', () => ({
  openInviteMembersModal: jest.fn(),
  openTeamAccessRequestModal: jest.fn(),
}));

describe('TeamMembers', function() {
  let createMock;

  const organization = TestStubs.Organization();
  const routerContext = TestStubs.routerContext([{organization}]);
  const team = TestStubs.Team();
  const members = TestStubs.Members();
  const member = TestStubs.Member({
    id: '9',
    email: 'sentry9@test.com',
    name: 'Sentry 9 Name',
  });

  beforeEach(function() {
    Client.clearMockResponses();
    Client.addMockResponse({
      url: `/organizations/${organization.slug}/members/`,
      method: 'GET',
      body: [member],
    });
    Client.addMockResponse({
      url: `/teams/${organization.slug}/${team.slug}/members/`,
      method: 'GET',
      body: members,
    });

    createMock = Client.addMockResponse({
      url: `/organizations/${organization.slug}/members/${member.id}/teams/${team.slug}/`,
      method: 'POST',
    });
  });

  it('renders', async function() {
    const wrapper = mountWithTheme(
      <TeamMembers
        params={{orgId: organization.slug, teamId: team.slug}}
        organization={organization}
      />,
      routerContext
    );
    await tick();
    wrapper.update();
  });

  it('can add member to team with open membership', async function() {
    const org = TestStubs.Organization({access: [], openMembership: true});
    const wrapper = mountWithTheme(
      <TeamMembers params={{orgId: org.slug, teamId: team.slug}} organization={org} />,
      routerContext
    );

    await tick();
    wrapper.update();

    wrapper.find('DropdownButton[data-test-id="add-member"]').simulate('click');
    wrapper
      .find('StyledUserListElement')
      .first()
      .simulate('click');

    await tick();
    wrapper.update();

    expect(createMock).toHaveBeenCalled();
  });

  it('can add member to team with team:admin permission', async function() {
    const org = TestStubs.Organization({access: ['team:admin'], openMembership: false});
    const wrapper = mountWithTheme(
      <TeamMembers params={{orgId: org.slug, teamId: team.slug}} organization={org} />,
      routerContext
    );

    await tick();
    wrapper.update();

    wrapper.find('DropdownButton[data-test-id="add-member"]').simulate('click');
    wrapper
      .find('StyledUserListElement')
      .first()
      .simulate('click');

    expect(createMock).toHaveBeenCalled();
  });

  it('can add member to team with org:write permission', async function() {
    const org = TestStubs.Organization({access: ['org:write'], openMembership: false});
    const wrapper = mountWithTheme(
      <TeamMembers params={{orgId: org.slug, teamId: team.slug}} organization={org} />,
      routerContext
    );

    await tick();
    wrapper.update();

    wrapper.find('DropdownButton[data-test-id="add-member"]').simulate('click');
    wrapper
      .find('StyledUserListElement')
      .first()
      .simulate('click');

    expect(createMock).toHaveBeenCalled();
  });

  it('can request access to add member to team without permission', async function() {
    const org = TestStubs.Organization({access: [], openMembership: false});
    const wrapper = mountWithTheme(
      <TeamMembers params={{orgId: org.slug, teamId: team.slug}} organization={org} />,
      routerContext
    );

    await tick();
    wrapper.update();

    wrapper.find('DropdownButton[data-test-id="add-member"]').simulate('click');
    wrapper
      .find('StyledUserListElement')
      .first()
      .simulate('click');

    expect(openTeamAccessRequestModal).toHaveBeenCalled();
  });

  it('can invite member from team dropdown with access', async function() {
    const org = TestStubs.Organization({access: ['team:admin'], openMembership: false});
    const wrapper = mountWithTheme(
      <TeamMembers params={{orgId: org.slug, teamId: team.slug}} organization={org} />,
      routerContext
    );

    await tick();
    wrapper.update();

    wrapper.find('DropdownButton[data-test-id="add-member"]').simulate('click');
    wrapper
      .find('StyledCreateMemberLink[data-test-id="invite-member"]')
      .simulate('click');

    expect(openInviteMembersModal).toHaveBeenCalled();
  });

  it('can invite member from team dropdown with access and `Open Membership` enabled', async function() {
    const org = TestStubs.Organization({access: ['team:admin'], openMembership: true});
    const wrapper = mountWithTheme(
      <TeamMembers params={{orgId: org.slug, teamId: team.slug}} organization={org} />,
      routerContext
    );

    await tick();
    wrapper.update();

    wrapper.find('DropdownButton[data-test-id="add-member"]').simulate('click');
    wrapper
      .find('StyledCreateMemberLink[data-test-id="invite-member"]')
      .simulate('click');

    expect(openInviteMembersModal).toHaveBeenCalled();
  });

  it('can invite member from team dropdown without access and `Open Membership` enabled', async function() {
    const org = TestStubs.Organization({access: [], openMembership: true});
    const wrapper = mountWithTheme(
      <TeamMembers params={{orgId: org.slug, teamId: team.slug}} organization={org} />,
      routerContext
    );

    await tick();
    wrapper.update();

    wrapper.find('DropdownButton[data-test-id="add-member"]').simulate('click');
    wrapper
      .find('StyledCreateMemberLink[data-test-id="invite-member"]')
      .simulate('click');

    expect(openInviteMembersModal).toHaveBeenCalled();
  });

  it('can invite member from team dropdown without access and `Open Membership` disabled', async function() {
    const org = TestStubs.Organization({access: [], openMembership: false});
    const wrapper = mountWithTheme(
      <TeamMembers params={{orgId: org.slug, teamId: team.slug}} organization={org} />,
      routerContext
    );

    await tick();
    wrapper.update();

    wrapper.find('DropdownButton[data-test-id="add-member"]').simulate('click');
    wrapper
      .find('StyledCreateMemberLink[data-test-id="invite-member"]')
      .simulate('click');

    expect(openInviteMembersModal).toHaveBeenCalled();
  });

  it('can remove member from team', async function() {
    const deleteMock = Client.addMockResponse({
      url: `/organizations/${organization.slug}/members/${members[0].id}/teams/${team.slug}/`,
      method: 'DELETE',
    });
    const wrapper = mountWithTheme(
      <TeamMembers
        params={{orgId: organization.slug, teamId: team.slug}}
        organization={organization}
      />,
      routerContext
    );

    await tick();
    wrapper.update();

    expect(deleteMock).not.toHaveBeenCalled();

    wrapper
      .find('Button')
      .at(1)
      .simulate('click');

    expect(deleteMock).toHaveBeenCalled();
  });

  it('can only remove self from team', async function() {
    const me = TestStubs.Member({
      id: '123',
      email: 'foo@example.com',
    });
    Client.addMockResponse({
      url: `/teams/${organization.slug}/${team.slug}/members/`,
      method: 'GET',
      body: [...members, me],
    });

    const deleteMock = Client.addMockResponse({
      url: `/organizations/${organization.slug}/members/${me.id}/teams/${team.slug}/`,
      method: 'DELETE',
    });
    const organizationMember = TestStubs.Organization({
      access: [],
    });

    const wrapper = mountWithTheme(
      <TeamMembers
        params={{orgId: organization.slug, teamId: team.slug}}
        organization={organizationMember}
      />,
      routerContext
    );

    await tick();
    wrapper.update();

    expect(deleteMock).not.toHaveBeenCalled();

    expect(wrapper.find('IdBadge')).toHaveLength(members.length + 1);

    // Can only remove self
    expect(wrapper.find('button[aria-label="Remove"]')).toHaveLength(1);

    wrapper.find('button[aria-label="Remove"]').simulate('click');
    expect(deleteMock).toHaveBeenCalled();
  });
});
