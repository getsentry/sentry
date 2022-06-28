import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {
  openInviteMembersModal,
  openTeamAccessRequestModal,
} from 'sentry/actionCreators/modal';
import {Client} from 'sentry/api';
import TeamMembers from 'sentry/views/settings/organizationTeams/teamMembers';

jest.mock('sentry/actionCreators/modal', () => ({
  openInviteMembersModal: jest.fn(),
  openTeamAccessRequestModal: jest.fn(),
}));

describe('TeamMembers', function () {
  let createMock;

  const organization = TestStubs.Organization();
  const team = TestStubs.Team();
  const members = TestStubs.Members();
  const member = TestStubs.Member({
    id: '9',
    email: 'sentry9@test.com',
    name: 'Sentry 9 Name',
  });

  beforeEach(function () {
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

  it('can add member to team with open membership', async function () {
    const org = TestStubs.Organization({access: [], openMembership: true});
    render(
      <TeamMembers params={{orgId: org.slug, teamId: team.slug}} organization={org} />
    );

    userEvent.click(await screen.findByTestId('add-member'));
    userEvent.click(screen.getAllByTestId('letter_avatar-avatar')[0]);

    expect(createMock).toHaveBeenCalled();
  });

  it('can add member to team with team:admin permission', async function () {
    const org = TestStubs.Organization({access: ['team:admin'], openMembership: false});
    render(
      <TeamMembers params={{orgId: org.slug, teamId: team.slug}} organization={org} />
    );

    userEvent.click(await screen.findByTestId('add-member'));
    userEvent.click(screen.getAllByTestId('letter_avatar-avatar')[0]);

    expect(createMock).toHaveBeenCalled();
  });

  it('can add member to team with org:write permission', async function () {
    const org = TestStubs.Organization({access: ['org:write'], openMembership: false});
    render(
      <TeamMembers params={{orgId: org.slug, teamId: team.slug}} organization={org} />
    );

    userEvent.click(await screen.findByTestId('add-member'));
    userEvent.click(screen.getAllByTestId('letter_avatar-avatar')[0]);

    expect(createMock).toHaveBeenCalled();
  });

  it('can request access to add member to team without permission', async function () {
    const org = TestStubs.Organization({access: [], openMembership: false});
    render(
      <TeamMembers params={{orgId: org.slug, teamId: team.slug}} organization={org} />
    );

    userEvent.click(await screen.findByTestId('add-member'));
    userEvent.click(screen.getAllByTestId('letter_avatar-avatar')[0]);

    expect(openTeamAccessRequestModal).toHaveBeenCalled();
  });

  it('can invite member from team dropdown with access', async function () {
    const org = TestStubs.Organization({access: ['team:admin'], openMembership: false});
    render(
      <TeamMembers params={{orgId: org.slug, teamId: team.slug}} organization={org} />
    );

    userEvent.click(await screen.findByTestId('add-member'));
    userEvent.click(screen.getByTestId('invite-member'));

    expect(openInviteMembersModal).toHaveBeenCalled();
  });

  it('can invite member from team dropdown with access and `Open Membership` enabled', async function () {
    const org = TestStubs.Organization({access: ['team:admin'], openMembership: true});
    render(
      <TeamMembers params={{orgId: org.slug, teamId: team.slug}} organization={org} />
    );

    userEvent.click(await screen.findByTestId('add-member'));
    userEvent.click(screen.getByTestId('invite-member'));

    expect(openInviteMembersModal).toHaveBeenCalled();
  });

  it('can invite member from team dropdown without access and `Open Membership` enabled', async function () {
    const org = TestStubs.Organization({access: [], openMembership: true});
    render(
      <TeamMembers params={{orgId: org.slug, teamId: team.slug}} organization={org} />
    );

    userEvent.click(await screen.findByTestId('add-member'));
    userEvent.click(screen.getByTestId('invite-member'));

    expect(openInviteMembersModal).toHaveBeenCalled();
  });

  it('can invite member from team dropdown without access and `Open Membership` disabled', async function () {
    const org = TestStubs.Organization({access: [], openMembership: false});
    render(
      <TeamMembers params={{orgId: org.slug, teamId: team.slug}} organization={org} />
    );

    userEvent.click(await screen.findByTestId('add-member'));
    userEvent.click(screen.getByTestId('invite-member'));

    expect(openInviteMembersModal).toHaveBeenCalled();
  });

  it('can remove member from team', async function () {
    const deleteMock = Client.addMockResponse({
      url: `/organizations/${organization.slug}/members/${members[0].id}/teams/${team.slug}/`,
      method: 'DELETE',
    });
    render(
      <TeamMembers
        params={{orgId: organization.slug, teamId: team.slug}}
        organization={organization}
      />
    );

    await screen.findByTestId('add-member');

    expect(deleteMock).not.toHaveBeenCalled();
    userEvent.click(screen.getAllByRole('button', {name: 'Remove'})[0]);

    expect(deleteMock).toHaveBeenCalled();
  });

  it('can only remove self from team', async function () {
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

    render(
      <TeamMembers
        params={{orgId: organization.slug, teamId: team.slug}}
        organization={organizationMember}
      />
    );

    await screen.findByTestId('add-member');

    expect(deleteMock).not.toHaveBeenCalled();

    expect(screen.getAllByTestId('letter_avatar-avatar')).toHaveLength(
      members.length + 1
    );

    // Can only remove self
    expect(screen.getByRole('button', {name: 'Remove'})).toBeInTheDocument();
    userEvent.click(screen.getByRole('button', {name: 'Remove'}));
    expect(deleteMock).toHaveBeenCalled();
  });
});
