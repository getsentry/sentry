import {MemberFixture} from 'sentry-fixture/member';
import {MembersFixture} from 'sentry-fixture/members';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {TeamFixture} from 'sentry-fixture/team';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {
  openInviteMembersModal,
  openTeamAccessRequestModal,
} from 'sentry/actionCreators/modal';
import TeamMembers from 'sentry/views/settings/organizationTeams/teamMembers';

jest.mock('sentry/actionCreators/modal', () => ({
  openInviteMembersModal: jest.fn(),
  openTeamAccessRequestModal: jest.fn(),
}));

describe('TeamMembers', () => {
  let createMock: jest.Mock;

  const organization = OrganizationFixture();
  const team = TeamFixture();
  const managerTeam = TeamFixture();
  const members = MembersFixture();
  const member = MemberFixture({
    id: '9',
    email: 'sentry9@test.com',
    name: 'Sentry 9 Name',
  });

  const initialRouterConfig = {
    location: {
      pathname: `/settings/${organization.slug}/teams/${team.slug}/members/`,
    },
    route: '/settings/:orgId/teams/:teamId/members/',
  };

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/members/`,
      method: 'GET',
      body: [member],
    });
    MockApiClient.addMockResponse({
      url: `/teams/${organization.slug}/${team.slug}/members/`,
      method: 'GET',
      body: members,
    });
    MockApiClient.addMockResponse({
      url: `/teams/${organization.slug}/${team.slug}/`,
      method: 'GET',
      body: team,
    });
    MockApiClient.addMockResponse({
      url: `/teams/${organization.slug}/${managerTeam.slug}/`,
      method: 'GET',
      body: managerTeam,
    });

    createMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/members/${member.id}/teams/${team.slug}/`,
      method: 'POST',
    });
  });

  it('can add member to team with open membership', async () => {
    const org = OrganizationFixture({access: [], openMembership: true});
    render(<TeamMembers />, {
      outletContext: {team},
      initialRouterConfig,
      organization: org,
    });

    await userEvent.click(
      (await screen.findAllByRole('button', {name: 'Add Member'}))[0]!
    );
    await userEvent.click(screen.getAllByTestId('letter_avatar-avatar')[0]!);

    expect(createMock).toHaveBeenCalled();
  });

  it('can add multiple members with one click on dropdown', async () => {
    const org = OrganizationFixture({access: [], openMembership: true});
    render(<TeamMembers />, {
      outletContext: {team},
      initialRouterConfig,
      organization: org,
    });

    await userEvent.click(
      (await screen.findAllByRole('button', {name: 'Add Member'}))[0]!
    );

    await userEvent.click(screen.getAllByTestId('letter_avatar-avatar')[0]!);
    expect(createMock).toHaveBeenCalled();
    expect(screen.getAllByTestId('add-member-menu')[0]).toBeVisible();
  });

  it('can add member to team with team:admin permission', async () => {
    const org = OrganizationFixture({access: ['team:admin'], openMembership: false});
    render(<TeamMembers />, {
      outletContext: {team},
      initialRouterConfig,
      organization: org,
    });

    await userEvent.click(
      (await screen.findAllByRole('button', {name: 'Add Member'}))[0]!
    );
    await userEvent.click(screen.getAllByTestId('letter_avatar-avatar')[0]!);

    expect(createMock).toHaveBeenCalled();
  });

  it('can add member to team with org:write permission', async () => {
    const org = OrganizationFixture({access: ['org:write'], openMembership: false});
    render(<TeamMembers />, {
      outletContext: {team},
      initialRouterConfig,
      organization: org,
    });

    await userEvent.click(
      (await screen.findAllByRole('button', {name: 'Add Member'}))[0]!
    );
    await userEvent.click(screen.getAllByTestId('letter_avatar-avatar')[0]!);

    expect(createMock).toHaveBeenCalled();
  });

  it('can request access to add member to team without permission', async () => {
    const org = OrganizationFixture({access: [], openMembership: false});
    render(<TeamMembers />, {
      outletContext: {team},
      initialRouterConfig,
      organization: org,
    });

    await userEvent.click(
      (await screen.findAllByRole('button', {name: 'Add Member'}))[0]!
    );
    await userEvent.click(screen.getAllByTestId('letter_avatar-avatar')[0]!);

    expect(openTeamAccessRequestModal).toHaveBeenCalled();
  });

  it('can invite member from team dropdown with access', async () => {
    const {organization: org} = initializeOrg({
      organization: OrganizationFixture({
        access: ['team:admin'],
        openMembership: false,
      }),
    });
    render(<TeamMembers />, {
      outletContext: {team},
      initialRouterConfig,
      organization: org,
    });

    await userEvent.click(
      (await screen.findAllByRole('button', {name: 'Add Member'}))[0]!
    );
    await userEvent.click(screen.getByTestId('invite-member'));

    expect(openInviteMembersModal).toHaveBeenCalled();
  });

  it('can invite member from team dropdown with access and `Open Membership` enabled', async () => {
    const {organization: org} = initializeOrg({
      organization: OrganizationFixture({
        access: ['team:admin'],
        openMembership: true,
      }),
    });
    render(<TeamMembers />, {
      outletContext: {team},
      initialRouterConfig,
      organization: org,
    });

    await userEvent.click(
      (await screen.findAllByRole('button', {name: 'Add Member'}))[0]!
    );
    await userEvent.click(screen.getByTestId('invite-member'));

    expect(openInviteMembersModal).toHaveBeenCalled();
  });

  it('can invite member from team dropdown without access and `Open Membership` enabled', async () => {
    const {organization: org} = initializeOrg({
      organization: OrganizationFixture({access: [], openMembership: true}),
    });
    render(<TeamMembers />, {
      outletContext: {team},
      initialRouterConfig,
      organization: org,
    });

    await userEvent.click(
      (await screen.findAllByRole('button', {name: 'Add Member'}))[0]!
    );
    await userEvent.click(screen.getByTestId('invite-member'));

    expect(openInviteMembersModal).toHaveBeenCalled();
  });

  it('can invite member from team dropdown without access and `Open Membership` disabled', async () => {
    const {organization: org} = initializeOrg({
      organization: OrganizationFixture({access: [], openMembership: false}),
    });
    render(<TeamMembers />, {
      outletContext: {team},
      initialRouterConfig,
      organization: org,
    });

    await userEvent.click(
      (await screen.findAllByRole('button', {name: 'Add Member'}))[0]!
    );
    await userEvent.click(screen.getByTestId('invite-member'));

    expect(openInviteMembersModal).toHaveBeenCalled();
  });

  it('can remove member from team', async () => {
    const deleteMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/members/${members[0]!.id}/teams/${team.slug}/`,
      method: 'DELETE',
    });
    render(<TeamMembers />, {
      outletContext: {team},
      initialRouterConfig,
      organization,
    });

    await screen.findAllByRole('button', {name: 'Add Member'});

    expect(deleteMock).not.toHaveBeenCalled();
    await userEvent.click(screen.getAllByRole('button', {name: 'Remove'})[0]!);

    expect(deleteMock).toHaveBeenCalled();
  });

  it('can only remove self from team', async () => {
    const me = MemberFixture({
      id: '123',
      email: 'foo@example.com',
    });
    MockApiClient.addMockResponse({
      url: `/teams/${organization.slug}/${team.slug}/members/`,
      method: 'GET',
      body: [...members, me],
    });

    const deleteMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/members/${me.id}/teams/${team.slug}/`,
      method: 'DELETE',
    });
    const organizationMember = OrganizationFixture({access: []});

    render(<TeamMembers />, {
      outletContext: {team},
      initialRouterConfig,
      organization: organizationMember,
    });

    await screen.findAllByRole('button', {name: 'Add Member'});

    expect(deleteMock).not.toHaveBeenCalled();

    expect(screen.getAllByTestId('letter_avatar-avatar')).toHaveLength(
      members.length + 1
    );

    // Can only remove self
    expect(screen.getByRole('button', {name: 'Leave'})).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name: 'Leave'}));
    expect(deleteMock).toHaveBeenCalled();
  });

  it('renders team-level roles without flag', async () => {
    const owner = MemberFixture({
      id: '123',
      email: 'foo@example.com',
      orgRole: 'owner',
      role: 'owner',
    });
    MockApiClient.addMockResponse({
      url: `/teams/${organization.slug}/${team.slug}/members/`,
      method: 'GET',
      body: [...members, owner],
    });

    render(<TeamMembers />, {
      outletContext: {team},
      initialRouterConfig,
      organization,
    });

    const admins = await screen.findAllByText('Team Admin');
    expect(admins).toHaveLength(3);
    const contributors = screen.queryAllByText('Contributor');
    expect(contributors).toHaveLength(2);
  });

  it('renders team-level roles with flag', async () => {
    const manager = MemberFixture({
      id: '123',
      email: 'foo@example.com',
      orgRole: 'manager',
      role: 'manager',
    });
    MockApiClient.addMockResponse({
      url: `/teams/${organization.slug}/${team.slug}/members/`,
      method: 'GET',
      body: [...members, manager],
    });

    const orgWithTeamRoles = OrganizationFixture({features: ['team-roles']});

    render(<TeamMembers />, {
      outletContext: {team},
      initialRouterConfig,
      organization: orgWithTeamRoles,
    });

    const admins = await screen.findAllByText('Team Admin');
    expect(admins).toHaveLength(3);
    const contributors = screen.queryAllByText('Contributor');
    expect(contributors).toHaveLength(2);
  });

  it('cannot add or remove members if team is idp:provisioned', async () => {
    const team2 = TeamFixture({
      flags: {
        'idp:provisioned': true,
      },
    });

    const me = MemberFixture({
      id: '123',
      email: 'foo@example.com',
      role: 'owner',
    });
    const idpMembers = members.map(teamMember => ({
      ...teamMember,
      flags: {...teamMember.flags, 'idp:provisioned': true},
    }));

    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/members/`,
      method: 'GET',
      body: [...idpMembers, me],
    });
    MockApiClient.addMockResponse({
      url: `/teams/${organization.slug}/${team2.slug}/members/`,
      method: 'GET',
      body: idpMembers,
    });
    MockApiClient.addMockResponse({
      url: `/teams/${organization.slug}/${team2.slug}/`,
      method: 'GET',
      body: team2,
    });

    render(<TeamMembers />, {
      outletContext: {team: team2},
      initialRouterConfig,
      organization,
    });

    expect(
      (await screen.findAllByRole('button', {name: 'Add Member'})).at(0)
    ).toBeDisabled();
    expect((await screen.findAllByRole('button', {name: 'Remove'})).at(0)).toBeDisabled();
  });

  it('can add or remove members if non-idp team', async () => {
    const team2 = TeamFixture({
      flags: {
        'idp:provisioned': false,
      },
    });

    const me = MemberFixture({
      id: '123',
      email: 'foo@example.com',
      role: 'owner',
    });
    const idpMembers = members.map(teamMember => ({
      ...teamMember,
      flags: {...teamMember.flags, 'idp:provisioned': true},
    }));

    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/members/`,
      method: 'GET',
      body: [...idpMembers, me],
    });
    MockApiClient.addMockResponse({
      url: `/teams/${organization.slug}/${team2.slug}/members/`,
      method: 'GET',
      body: idpMembers,
    });
    MockApiClient.addMockResponse({
      url: `/teams/${organization.slug}/${team2.slug}/`,
      method: 'GET',
      body: team2,
    });

    render(<TeamMembers />, {
      outletContext: {team: team2},
      initialRouterConfig,
      organization,
    });

    expect(
      (await screen.findAllByRole('button', {name: 'Add Member'})).at(0)
    ).toBeEnabled();
    expect((await screen.findAllByRole('button', {name: 'Remove'})).at(0)).toBeEnabled();
  });

  it('renders a "Pending" tag for pending team members', async () => {
    render(<TeamMembers />, {
      outletContext: {team},
      initialRouterConfig,
      organization,
    });

    // MembersFixure has a single pending member
    expect(await screen.findByText('Pending')).toBeInTheDocument();
  });

  it('filters out null members from API response', async () => {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/members/`,
      method: 'GET',
      body: [member, null, MemberFixture({id: '10', email: 'sentry10@test.com'})],
    });
    MockApiClient.addMockResponse({
      url: `/teams/${organization.slug}/${team.slug}/members/`,
      method: 'GET',
      body: members,
    });
    MockApiClient.addMockResponse({
      url: `/teams/${organization.slug}/${team.slug}/`,
      method: 'GET',
      body: team,
    });

    const org = OrganizationFixture({access: [], openMembership: true});
    render(<TeamMembers />, {
      outletContext: {team},
      initialRouterConfig,
      organization: org,
    });

    await userEvent.click(
      (await screen.findAllByRole('button', {name: 'Add Member'}))[0]!
    );

    // Should render 2 members (member and sentry10), null should be filtered out
    const avatars = screen.getAllByTestId('letter_avatar-avatar');
    expect(avatars).toHaveLength(2);
  });
});
