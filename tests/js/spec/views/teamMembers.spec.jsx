import React from 'react';

import {Client} from 'app/api';
import {initializeOrg} from 'sentry-test/initializeOrg';
import {mountWithTheme} from 'sentry-test/enzyme';
import {openInviteMembersModal} from 'app/actionCreators/modal';
import TeamMembers from 'app/views/settings/organizationTeams/teamMembers';

jest.mock('app/actionCreators/modal', () => ({
  openInviteMembersModal: jest.fn(),
}));

describe('TeamMembers', function() {
  const {organization, routerContext} = initializeOrg();
  const team = TestStubs.Team();
  const members = TestStubs.Members();

  beforeEach(function() {
    Client.clearMockResponses();
    Client.addMockResponse({
      url: `/organizations/${organization.slug}/members/`,
      method: 'GET',
      body: members,
    });
    Client.addMockResponse({
      url: `/teams/${organization.slug}/${team.slug}/members/`,
      method: 'GET',
      body: members,
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

  it('cannot invite member from team dropdown without access and `Open Membership` disabled', async function() {
    const org = TestStubs.Organization({access: [], openMembership: false});
    const wrapper = mountWithTheme(
      <TeamMembers params={{orgId: org.slug, teamId: team.slug}} organization={org} />,
      routerContext
    );

    await tick();
    wrapper.update();

    expect(
      wrapper.find('DropdownButton[data-test-id="add-member"]').prop('disabled')
    ).toBe(true);
  });

  it('can remove member from team', async function() {
    const endpoint = `/organizations/${organization.slug}/members/${
      members[0].id
    }/teams/${team.slug}/`;
    const mock = Client.addMockResponse({
      url: endpoint,
      method: 'DELETE',
      statusCode: 200,
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

    expect(mock).not.toHaveBeenCalled();

    wrapper
      .find('Button')
      .at(1)
      .simulate('click');

    expect(mock).toHaveBeenCalledWith(
      endpoint,
      expect.objectContaining({
        method: 'DELETE',
      })
    );
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

    const endpoint = `/organizations/${organization.slug}/members/${me.id}/teams/${
      team.slug
    }/`;
    const mock = Client.addMockResponse({
      url: endpoint,
      method: 'DELETE',
      statusCode: 200,
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

    expect(mock).not.toHaveBeenCalled();

    expect(wrapper.find('IdBadge')).toHaveLength(members.length + 1);

    // Can only remove self
    expect(wrapper.find('button[aria-label="Remove"]')).toHaveLength(1);

    wrapper.find('button[aria-label="Remove"]').simulate('click');
    expect(mock).toHaveBeenCalledWith(
      endpoint,
      expect.objectContaining({
        method: 'DELETE',
      })
    );
  });
});
