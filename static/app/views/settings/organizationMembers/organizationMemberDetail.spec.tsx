import {UserEnrolledAuthenticatorFixture} from 'sentry-fixture/authenticators';
import {MemberFixture} from 'sentry-fixture/member';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {OrgRoleListFixture} from 'sentry-fixture/roleList';
import {TeamFixture} from 'sentry-fixture/team';
import {UserFixture} from 'sentry-fixture/user';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {
  cleanup,
  render,
  renderGlobalModal,
  screen,
  userEvent,
  within,
} from 'sentry-test/reactTestingLibrary';
import selectEvent from 'sentry-test/selectEvent';

import {updateMember} from 'sentry/actionCreators/members';
import TeamStore from 'sentry/stores/teamStore';
import type {Member} from 'sentry/types/organization';

import OrganizationMemberDetail from './organizationMemberDetail';

jest.mock('sentry/actionCreators/members', () => ({
  updateMember: jest.fn().mockReturnValue(new Promise(() => {})),
}));

describe('OrganizationMemberDetail', function () {
  const team = TeamFixture();
  const idpTeam = TeamFixture({
    id: '3',
    slug: 'idp-member-team',
    name: 'Idp Member Team',
    isMember: true,
    flags: {
      'idp:provisioned': true,
    },
  });
  const teams = [
    team,
    TeamFixture({
      id: '2',
      slug: 'new-team',
      name: 'New Team',
      isMember: false,
    }),
    idpTeam,
  ];

  const teamAssignment = {
    teams: [team.slug],
    teamRoles: [
      {
        teamSlug: team.slug,
        role: null,
      },
    ],
  };

  const member = MemberFixture({
    roles: OrgRoleListFixture(),
    dateCreated: new Date().toISOString(),
    ...teamAssignment,
  });
  const pendingMember = MemberFixture({
    id: '2',
    roles: OrgRoleListFixture(),
    dateCreated: new Date().toISOString(),
    ...teamAssignment,
    invite_link: 'http://example.com/i/abc123',
    pending: true,
  });
  const expiredMember = MemberFixture({
    id: '3',
    roles: OrgRoleListFixture(),
    dateCreated: new Date().toISOString(),
    ...teamAssignment,
    invite_link: 'http://example.com/i/abc123',
    pending: true,
    expired: true,
  });
  const idpTeamMember = MemberFixture({
    id: '4',
    roles: OrgRoleListFixture(),
    dateCreated: new Date().toISOString(),
    teams: [idpTeam.slug],
    teamRoles: [
      {
        teamSlug: idpTeam.slug,
        role: null,
      },
    ],
  });
  const managerMember = MemberFixture({
    id: '6',
    roles: OrgRoleListFixture(),
    role: 'manager',
  });

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    TeamStore.loadInitialData(teams);
  });

  describe('Can Edit', function () {
    const organization = OrganizationFixture({features: ['team-roles']});

    beforeEach(function () {
      TeamStore.init();
      TeamStore.loadInitialData(teams);

      jest.resetAllMocks();

      MockApiClient.clearMockResponses();
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/members/${member.id}/`,
        body: member,
      });
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/members/${pendingMember.id}/`,
        body: pendingMember,
      });
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/members/${expiredMember.id}/`,
        body: expiredMember,
      });
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/members/${idpTeamMember.id}/`,
        body: idpTeamMember,
      });
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/members/${managerMember.id}/`,
        body: managerMember,
      });
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/teams/`,
        body: teams,
      });
    });

    it('changes org role to owner', async function () {
      const {router} = initializeOrg({
        organization,
        router: {params: {memberId: member.id}},
      });

      render(<OrganizationMemberDetail />, {
        router,
        organization,
      });

      // Should have 5 roles
      const radios = await screen.findAllByRole('radio');
      expect(radios).toHaveLength(5);

      // Click last radio
      await userEvent.click(radios.at(-1) as Element);
      expect(radios.at(-1)).toBeChecked();

      // Save Member
      await userEvent.click(screen.getByRole('button', {name: 'Save Member'}));

      expect(updateMember).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: expect.objectContaining({
            orgRole: 'owner',
          }),
        })
      );
    });

    it('leaves a team', async function () {
      const {router} = initializeOrg({
        organization,
        router: {params: {memberId: member.id}},
      });

      render(<OrganizationMemberDetail />, {
        router,
        organization,
      });

      // Remove our one team
      await userEvent.click(await screen.findByRole('button', {name: 'Remove'}));

      // Save Member
      await userEvent.click(screen.getByRole('button', {name: 'Save Member'}));

      expect(updateMember).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: expect.objectContaining({
            teamRoles: [],
          }),
        })
      );
    });

    it('cannot leave idp-provisioned team', async function () {
      const {router} = initializeOrg({
        organization,
        router: {params: {memberId: idpTeamMember.id}},
      });

      render(<OrganizationMemberDetail />, {
        router,
        organization,
      });

      expect(await screen.findByRole('button', {name: 'Remove'})).toBeDisabled();
    });

    it('joins a team and assign a team-role', async function () {
      const {router} = initializeOrg({
        organization,
        router: {params: {memberId: member.id}},
      });

      render(<OrganizationMemberDetail />, {
        router,
        organization,
      });

      // Should have one team enabled
      expect(await screen.findByTestId('team-row-for-member')).toBeInTheDocument();

      // Select new team to join
      // Open the dropdown
      await userEvent.click(screen.getByText('Add Team'));
      // Click the first item
      await userEvent.click(screen.getByText('#new-team'));

      // Assign as admin to new team
      const teamRoleSelect = screen.getAllByText('Contributor')[0]!;
      await selectEvent.select(teamRoleSelect, ['Team Admin']);

      // Save Member
      await userEvent.click(screen.getByRole('button', {name: 'Save Member'}));

      expect(updateMember).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: expect.objectContaining({
            teamRoles: [
              {teamSlug: 'team-slug', role: null},
              {teamSlug: 'new-team', role: 'admin'},
            ],
          }),
        })
      );
    });

    it('cannot join idp-provisioned team', async function () {
      const {router} = initializeOrg({
        organization,
        router: {params: {memberId: member.id}},
      });

      render(<OrganizationMemberDetail />, {
        router,
        organization,
      });

      await userEvent.click(await screen.findByText('Add Team'));
      await userEvent.hover(screen.getByText('#idp-member-team'));
      expect(
        await screen.findByText(
          "Membership to this team is managed through your organization's identity provider."
        )
      ).toBeInTheDocument();
    });
  });

  describe('Cannot Edit', function () {
    const organization = OrganizationFixture({access: ['org:read']});

    beforeEach(function () {
      TeamStore.init();
      TeamStore.loadInitialData(teams);
      jest.resetAllMocks();
      MockApiClient.clearMockResponses();

      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/members/${member.id}/`,
        body: member,
      });
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/members/${pendingMember.id}/`,
        body: pendingMember,
      });
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/members/${expiredMember.id}/`,
        body: expiredMember,
      });
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/teams/`,
        body: teams,
      });
    });

    it('can not change roles, teams, or save', async function () {
      const {router} = initializeOrg({
        organization,
        router: {params: {memberId: member.id}},
      });

      render(<OrganizationMemberDetail />, {
        router,
        organization,
      });

      // Should have 4 roles
      const radios = await screen.findAllByRole('radio');
      expect(radios.at(0)).toHaveAttribute('readonly');

      // Save Member
      expect(screen.getByRole('button', {name: 'Save Member'})).toBeDisabled();
    });
  });

  describe('Display status', function () {
    const organization = OrganizationFixture({access: ['org:read']});

    beforeEach(function () {
      TeamStore.init();
      TeamStore.loadInitialData(teams);
      jest.resetAllMocks();
      MockApiClient.clearMockResponses();

      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/members/${member.id}/`,
        body: member,
      });
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/members/${pendingMember.id}/`,
        body: pendingMember,
      });
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/members/${expiredMember.id}/`,
        body: expiredMember,
      });
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/teams/`,
        body: teams,
      });
    });

    it('display pending status', async function () {
      const {router} = initializeOrg({
        organization,
        router: {params: {memberId: pendingMember.id}},
      });

      render(<OrganizationMemberDetail />, {
        router,
        organization,
      });

      expect(await screen.findByTestId('member-status')).toHaveTextContent(
        'Invitation Pending'
      );
    });

    it('display expired status', async function () {
      const {router} = initializeOrg({
        organization,
        router: {params: {memberId: expiredMember.id}},
      });

      render(<OrganizationMemberDetail />, {
        router,
        organization,
      });

      expect(await screen.findByTestId('member-status')).toHaveTextContent(
        'Invitation Expired'
      );
    });
  });

  describe('Show resend button', function () {
    const organization = OrganizationFixture({access: ['org:read']});

    beforeEach(function () {
      TeamStore.init();
      TeamStore.loadInitialData(teams);
      jest.resetAllMocks();
      MockApiClient.clearMockResponses();

      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/members/${member.id}/`,
        body: member,
      });
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/members/${pendingMember.id}/`,
        body: pendingMember,
      });
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/members/${expiredMember.id}/`,
        body: expiredMember,
      });
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/teams/`,
        body: teams,
      });
    });

    it('shows for pending', async function () {
      const {router} = initializeOrg({
        organization,
        router: {params: {memberId: pendingMember.id}},
      });

      render(<OrganizationMemberDetail />, {
        router,
        organization,
      });

      expect(
        await screen.findByRole('button', {name: 'Resend Invite'})
      ).toBeInTheDocument();
    });

    it('does not show for expired', async function () {
      const {router} = initializeOrg({
        organization,
        router: {params: {memberId: expiredMember.id}},
      });

      render(<OrganizationMemberDetail />, {
        router,
        organization,
      });

      await screen.findAllByRole('radio');
      expect(
        screen.queryByRole('button', {name: 'Resend Invite'})
      ).not.toBeInTheDocument();
    });
  });

  describe('Reset member 2FA', function () {
    const fields = {
      roles: OrgRoleListFixture(),
      dateCreated: new Date().toISOString(),
      ...teamAssignment,
    };

    const noAccess = MemberFixture({
      ...fields,
      id: '4',
      user: UserFixture({has2fa: false, authenticators: undefined}),
    });

    const no2fa = MemberFixture({
      ...fields,
      id: '5',
      user: UserFixture({has2fa: false, authenticators: [], canReset2fa: true}),
    });

    const has2fa = MemberFixture({
      ...fields,
      id: '6',
      user: UserFixture({
        has2fa: true,
        authenticators: [
          UserEnrolledAuthenticatorFixture({type: 'totp', id: 'totp'}),
          UserEnrolledAuthenticatorFixture({type: 'sms', id: 'sms'}),
          UserEnrolledAuthenticatorFixture({type: 'u2f', id: 'u2f'}),
        ],
        canReset2fa: true,
      }),
    });

    const multipleOrgs = MemberFixture({
      ...fields,
      id: '7',
      user: UserFixture({
        has2fa: true,
        authenticators: [UserEnrolledAuthenticatorFixture({type: 'totp', id: 'totp'})],
        canReset2fa: false,
      }),
    });

    const organization = OrganizationFixture();

    beforeEach(function () {
      MockApiClient.clearMockResponses();
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/members/${pendingMember.id}/`,
        body: pendingMember,
      });
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/members/${noAccess.id}/`,
        body: noAccess,
      });
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/members/${no2fa.id}/`,
        body: no2fa,
      });
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/members/${has2fa.id}/`,
        body: has2fa,
      });
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/members/${multipleOrgs.id}/`,
        body: multipleOrgs,
      });
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/teams/`,
        body: teams,
      });
    });

    const tooltip = () => screen.queryByTestId('reset-2fa-tooltip');

    const expectButtonEnabled = async () => {
      const button = await screen.findByRole('button', {
        name: 'Reset two-factor authentication',
      });
      expect(button).toHaveTextContent('Reset two-factor authentication');
      expect(button).toBeEnabled();

      expect(tooltip()).not.toBeInTheDocument();
    };

    const expectButtonDisabled = async (title: string) => {
      const button = await screen.findByRole('button', {
        name: 'Reset two-factor authentication',
      });
      expect(button).toHaveTextContent('Reset two-factor authentication');
      expect(button).toBeDisabled();

      await userEvent.hover(button);
      expect(await screen.findByText(title)).toBeInTheDocument();
    };

    it('does not show for pending member', async function () {
      const {router} = initializeOrg({
        organization,
        router: {params: {memberId: pendingMember.id}},
      });

      render(<OrganizationMemberDetail />, {
        router,
        organization,
      });

      expect(
        await screen.findByRole('button', {name: 'Resend Invite'})
      ).toBeInTheDocument();
      expect(
        screen.queryByRole('button', {name: 'Reset two-factor authentication'})
      ).not.toBeInTheDocument();
    });

    it('shows tooltip for joined member without permission to edit', async function () {
      const {router} = initializeOrg({
        organization,
        router: {params: {memberId: noAccess.id}},
      });

      render(<OrganizationMemberDetail />, {
        router,
        organization,
      });
      await expectButtonDisabled('You do not have permission to perform this action');
    });

    it('shows tooltip for member without 2fa', async function () {
      const {router} = initializeOrg({
        organization,
        router: {params: {memberId: no2fa.id}},
      });

      render(<OrganizationMemberDetail />, {
        router,
        organization,
      });
      await expectButtonDisabled('Not enrolled in two-factor authentication');
    });

    it('can reset member 2FA', async function () {
      const {router} = initializeOrg({
        organization,
        router: {params: {memberId: has2fa.id}},
      });

      const deleteMocks = (has2fa.user?.authenticators || []).map(auth =>
        MockApiClient.addMockResponse({
          url: `/users/${has2fa.user?.id}/authenticators/${auth.id}/`,
          method: 'DELETE',
        })
      );

      render(<OrganizationMemberDetail />, {
        router,
        organization,
      });
      renderGlobalModal();

      await expectButtonEnabled();
      await userEvent.click(
        screen.getByRole('button', {name: 'Reset two-factor authentication'})
      );

      await userEvent.click(screen.getByRole('button', {name: 'Confirm'}));

      deleteMocks.forEach(deleteMock => {
        expect(deleteMock).toHaveBeenCalled();
      });
    });

    it('shows tooltip for member in multiple orgs', async function () {
      const {router} = initializeOrg({
        organization,
        router: {params: {memberId: multipleOrgs.id}},
      });

      render(<OrganizationMemberDetail />, {
        router,
        organization,
      });
      await expectButtonDisabled(
        'Cannot be reset since user is in more than one organization'
      );
    });

    it('shows tooltip for member in 2FA required org', async function () {
      organization.require2FA = true;
      const {router} = initializeOrg({
        organization,
        router: {params: {memberId: has2fa.id}},
      });
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/members/${has2fa.id}/`,
        body: has2fa,
      });

      render(<OrganizationMemberDetail />, {
        router,
        organization,
      });
      await expectButtonDisabled(
        'Cannot be reset since two-factor is required for this organization'
      );
    });
  });

  describe('Org Roles affect Team Roles', () => {
    // Org Admin will be deprecated
    const admin = MemberFixture({
      id: '4',
      role: 'admin',
      roleName: 'Admin',
      orgRole: 'admin',
      ...teamAssignment,
    });
    const manager = MemberFixture({
      id: '5',
      role: 'manager',
      roleName: 'Manager',
      orgRole: 'manager',
      ...teamAssignment,
    });
    const owner = MemberFixture({
      id: '6',
      role: 'owner',
      roleName: 'Owner',
      orgRole: 'owner',
      ...teamAssignment,
    });

    const organization = OrganizationFixture({features: ['team-roles']});

    beforeEach(() => {
      MockApiClient.clearMockResponses();
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/members/${member.id}/`,
        body: member,
      });
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/members/${admin.id}/`,
        body: admin,
      });
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/members/${manager.id}/`,
        body: manager,
      });
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/members/${owner.id}/`,
        body: owner,
      });
    });

    it('does not overwrite team-roles for org members', async () => {
      const {router} = initializeOrg({
        organization,
        router: {params: {memberId: member.id}},
      });

      render(<OrganizationMemberDetail />, {
        router,
        organization,
      });

      // Role info box is hidden
      expect(screen.queryByTestId('alert-role-overwrite')).not.toBeInTheDocument();

      // Dropdown has correct value set
      const teamRow = await screen.findByTestId('team-row-for-member');
      const teamRoleSelect = within(teamRow).getByText('Contributor');

      // Dropdown options are not visible
      expect(screen.queryAllByText('...').length).toBe(0);

      // Dropdown can be opened
      await selectEvent.openMenu(teamRoleSelect);
      expect(screen.queryAllByText('...').length).toBe(2);

      // Dropdown value can be changed
      await userEvent.click(screen.getByLabelText('Team Admin'));
      expect(teamRoleSelect).toHaveTextContent('Team Admin');
    });

    it('overwrite team-roles for org admin/manager/owner', async () => {
      async function testForOrgRole(testMember: Member) {
        const {router} = initializeOrg({
          organization,
          router: {params: {memberId: testMember.id}},
        });
        cleanup();
        render(<OrganizationMemberDetail />, {
          router,
          organization,
        });

        // Role info box is showed
        expect(await screen.findByTestId('alert-role-overwrite')).toBeInTheDocument();

        // Dropdown has correct value set
        const teamRow = screen.getByTestId('team-row-for-member');
        const teamRoleSelect = within(teamRow).getByText('Team Admin');

        // Dropdown options are not visible
        expect(screen.queryAllByText('...').length).toBe(0);

        // Dropdown cannot be opened
        await selectEvent.openMenu(teamRoleSelect);
        expect(screen.queryAllByText('...').length).toBe(0);
      }

      for (const role of [admin, manager, owner]) {
        await testForOrgRole(role);
      }
    });

    it('overwrites when changing from member to manager', async () => {
      const {router} = initializeOrg({
        organization,
        router: {params: {memberId: member.id}},
      });

      render(<OrganizationMemberDetail />, {
        router,
        organization,
      });

      // Dropdown has correct value set
      const teamRow = await screen.findByTestId('team-row-for-member');
      const teamRoleSelect = within(teamRow).getByText('Contributor');

      // Role info box is hidden
      expect(screen.queryByTestId('alert-role-overwrite')).not.toBeInTheDocument();

      // Change member to owner
      const orgRoleRadio = screen.getAllByRole('radio');
      expect(orgRoleRadio).toHaveLength(5);
      await userEvent.click(orgRoleRadio.at(-1) as Element);
      expect(orgRoleRadio.at(-1)).toBeChecked();

      // Role info box is shown
      expect(screen.getByTestId('alert-role-overwrite')).toBeInTheDocument();

      // Dropdown has correct value set
      within(teamRow).getByText('Team Admin');

      // Dropdown options are not visible
      expect(screen.queryAllByText('...').length).toBe(0);

      // Dropdown cannot be opened
      await selectEvent.openMenu(teamRoleSelect);
      expect(screen.queryAllByText('...').length).toBe(0);
    });
  });
});
