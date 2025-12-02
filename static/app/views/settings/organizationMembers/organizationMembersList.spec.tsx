import {AuthProviderFixture} from 'sentry-fixture/authProvider';
import {MemberFixture} from 'sentry-fixture/member';
import {MembersFixture} from 'sentry-fixture/members';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {TeamFixture} from 'sentry-fixture/team';
import {UserFixture} from 'sentry-fixture/user';

import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';
import selectEvent from 'sentry-test/selectEvent';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import ConfigStore from 'sentry/stores/configStore';
import OrganizationsStore from 'sentry/stores/organizationsStore';
import {trackAnalytics} from 'sentry/utils/analytics';
import {isDemoModeActive} from 'sentry/utils/demoMode';
import OrganizationMembersList from 'sentry/views/settings/organizationMembers/organizationMembersList';

jest.mock('sentry/utils/analytics');
jest.mock('sentry/actionCreators/indicator');
jest.mock('sentry/utils/demoMode');

const roles = [
  {
    id: 'admin',
    name: 'Admin',
    desc: 'This is the admin role',
    isAllowed: true,
  },
  {
    id: 'member',
    name: 'Member',
    desc: 'This is the member role',
    isAllowed: true,
  },
  {
    id: 'owner',
    name: 'Owner',
    desc: 'This is the owner role',
    isAllowed: true,
  },
];

describe('OrganizationMembersList', () => {
  const members = MembersFixture();

  const team = TeamFixture({slug: 'team'});
  const member = MemberFixture({
    id: '5',
    email: 'member@sentry.io',
    teams: [team.slug],
    teamRoles: [
      {
        teamSlug: team.slug,
        role: null,
      },
    ],
    flags: {
      'sso:linked': true,
      'idp:provisioned': false,
      'idp:role-restricted': false,
      'member-limit:restricted': false,
      'partnership:restricted': false,
      'sso:invalid': false,
    },
  });

  const currentUser = members[1]!;
  currentUser.user = UserFixture({
    ...currentUser,
    flags: {newsletter_consent_prompt: true},
  });
  const organization = OrganizationFixture({
    access: ['member:admin', 'org:admin', 'member:write'],
    status: {
      id: 'active',
      name: 'active',
    },
  });

  beforeEach(() => {
    ConfigStore.set('user', currentUser.user!);
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/members/me/',
      method: 'GET',
      body: {roles},
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/members/',
      method: 'GET',
      body: [...MembersFixture(), member],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/members/${member.id}/`,
      body: member,
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/access-requests/',
      method: 'GET',
      body: [
        {
          id: 'pending-id',
          member: {
            id: 'pending-member-id',
            email: '',
            name: '',
            role: '',
            roleName: '',
            user: {
              id: '',
              name: 'sentry@test.com',
            },
          },
          team: TeamFixture(),
        },
      ],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/auth-provider/',
      method: 'GET',
      body: {
        ...AuthProviderFixture(),
        require_link: true,
      },
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/teams/',
      method: 'GET',
      body: [TeamFixture(), team],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/invite-requests/',
      method: 'GET',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/missing-members/',
      method: 'GET',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/prompts-activity/',
      method: 'GET',
      body: {
        dismissed_ts: undefined,
        snoozed_ts: undefined,
      },
    });
    OrganizationsStore.load([organization]);
  });

  it('can remove a member', async () => {
    const deleteMock = MockApiClient.addMockResponse({
      url: `/organizations/org-slug/members/${members[0]!.id}/`,
      method: 'DELETE',
    });

    render(<OrganizationMembersList />, {
      organization,
    });
    renderGlobalModal();

    // The organization member row
    expect(await screen.findByTestId(members[0]!.email)).toBeInTheDocument();

    await userEvent.click(
      within(screen.getByTestId(members[0]!.email)).getByRole('button', {name: 'Remove'})
    );
    await userEvent.click(await screen.findByRole('button', {name: 'Confirm'}));

    await waitFor(() => expect(addSuccessMessage).toHaveBeenCalled());

    expect(deleteMock).toHaveBeenCalled();
    expect(OrganizationsStore.getAll()).toEqual([organization]);
  });

  it('displays error message when failing to remove member', async () => {
    const deleteMock = MockApiClient.addMockResponse({
      url: `/organizations/org-slug/members/${members[0]!.id}/`,
      method: 'DELETE',
      statusCode: 500,
    });

    render(<OrganizationMembersList />, {
      organization,
    });
    renderGlobalModal();

    // The organization member row
    expect(await screen.findByTestId(members[0]!.email)).toBeInTheDocument();

    await userEvent.click(
      within(screen.getByTestId(members[0]!.email)).getByRole('button', {name: 'Remove'})
    );
    await userEvent.click(await screen.findByRole('button', {name: 'Confirm'}));

    await waitFor(() => expect(addErrorMessage).toHaveBeenCalled());

    expect(deleteMock).toHaveBeenCalled();
    expect(OrganizationsStore.getAll()).toEqual([organization]);
  });

  it('can leave org', async () => {
    const deleteMock = MockApiClient.addMockResponse({
      url: `/organizations/org-slug/members/${members[1]!.id}/`,
      method: 'DELETE',
    });

    const {router} = render(<OrganizationMembersList />, {
      organization,
    });
    renderGlobalModal();

    await userEvent.click(await screen.findByRole('button', {name: 'Leave'}));
    await userEvent.click(await screen.findByRole('button', {name: 'Confirm'}));

    await waitFor(() => expect(addSuccessMessage).toHaveBeenCalled());

    expect(deleteMock).toHaveBeenCalled();
    await waitFor(() => {
      expect(router.location.pathname).toBe('/organizations/new/');
    });
  });

  it('can redirect to remaining org after leaving', async () => {
    const deleteMock = MockApiClient.addMockResponse({
      url: `/organizations/org-slug/members/${members[1]!.id}/`,
      method: 'DELETE',
    });
    const secondOrg = OrganizationFixture({
      slug: 'org-two',
      status: {
        id: 'active',
        name: 'active',
      },
    });
    OrganizationsStore.addOrReplace(secondOrg);

    const {router} = render(<OrganizationMembersList />, {
      organization,
    });
    renderGlobalModal();

    await userEvent.click(await screen.findByRole('button', {name: 'Leave'}));
    await userEvent.click(screen.getByTestId('confirm-button'));

    await waitFor(() => expect(addSuccessMessage).toHaveBeenCalled());

    expect(deleteMock).toHaveBeenCalled();
    await waitFor(() => {
      expect(router.location.pathname).toBe('/organizations/org-two/issues/');
    });
    expect(OrganizationsStore.getAll()).toEqual([secondOrg]);
  });

  it('displays error message when failing to leave org', async () => {
    const deleteMock = MockApiClient.addMockResponse({
      url: `/organizations/org-slug/members/${members[1]!.id}/`,
      method: 'DELETE',
      statusCode: 500,
    });

    render(<OrganizationMembersList />, {
      organization,
    });
    renderGlobalModal();

    await userEvent.click(await screen.findByRole('button', {name: 'Leave'}));
    await userEvent.click(await screen.findByRole('button', {name: 'Confirm'}));

    await waitFor(() => expect(addErrorMessage).toHaveBeenCalled());

    expect(deleteMock).toHaveBeenCalled();
    expect(OrganizationsStore.getAll()).toEqual([organization]);
  });

  it('can re-send SSO link to member', async () => {
    const inviteMock = MockApiClient.addMockResponse({
      url: `/organizations/org-slug/members/${members[0]!.id}/`,
      method: 'PUT',
      body: {
        id: '1234',
      },
    });

    render(<OrganizationMembersList />, {
      organization,
    });

    expect(inviteMock).not.toHaveBeenCalled();

    await userEvent.click(await screen.findByRole('button', {name: 'Resend SSO link'}));
    expect(inviteMock).toHaveBeenCalled();
  });

  it('can re-send invite to member', async () => {
    const inviteMock = MockApiClient.addMockResponse({
      url: `/organizations/org-slug/members/${members[1]!.id}/`,
      method: 'PUT',
      body: {
        id: '1234',
      },
    });

    render(<OrganizationMembersList />, {
      organization,
    });

    expect(inviteMock).not.toHaveBeenCalled();

    await userEvent.click(await screen.findByRole('button', {name: 'Resend invite'}));
    expect(inviteMock).toHaveBeenCalled();
  });

  it('can search organization members', async () => {
    const searchMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/members/',
      body: [],
    });

    const {router, rerender} = render(<OrganizationMembersList />, {
      organization,
      initialRouterConfig: {
        location: {
          pathname: `/organizations/${organization.slug}/settings/members/`,
        },
        route: '/organizations/:orgId/settings/members/',
      },
    });

    await userEvent.type(await screen.findByPlaceholderText('Search Members'), 'member');

    router.navigate(`${router.location.pathname}?query=member`);
    rerender(<OrganizationMembersList />);

    expect(searchMock).toHaveBeenLastCalledWith(
      '/organizations/org-slug/members/',
      expect.objectContaining({
        method: 'GET',
        query: {
          query: 'member',
        },
      })
    );

    await userEvent.keyboard('{enter}');

    await waitFor(() => {
      expect(router.location.query.query).toBe('member');
    });
  });

  it('can filter members', async () => {
    const searchMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/members/',
      body: [],
    });

    const {router, rerender} = render(<OrganizationMembersList />, {
      organization,
      initialRouterConfig: {
        location: {
          pathname: `/organizations/${organization.slug}/settings/members/`,
        },
        route: '/organizations/:orgId/settings/members/',
      },
    });

    await userEvent.click(await screen.findByRole('button', {name: 'Filter'}));
    await userEvent.click(screen.getByRole('option', {name: 'Member'}));

    router.navigate(`${router.location.pathname}?query=role:member`);
    rerender(<OrganizationMembersList />);

    expect(searchMock).toHaveBeenLastCalledWith(
      '/organizations/org-slug/members/',
      expect.objectContaining({
        method: 'GET',
        query: {query: 'role:member'},
      })
    );

    await userEvent.click(screen.getByRole('option', {name: 'Member'}));

    for (const [filter, label] of [
      ['isInvited', 'Invited'],
      ['has2fa', '2FA'],
      ['ssoLinked', 'SSO Linked'],
    ]) {
      const filterSection = screen.getByRole('listbox', {name: label});
      await userEvent.click(
        within(filterSection).getByRole('option', {
          name: 'True',
        })
      );

      router.navigate(`${router.location.pathname}?query=${filter}:true`);
      rerender(<OrganizationMembersList />);
      expect(searchMock).toHaveBeenLastCalledWith(
        '/organizations/org-slug/members/',
        expect.objectContaining({
          method: 'GET',
          query: {query: `${filter}:true`},
        })
      );

      await userEvent.click(
        within(filterSection).getByRole('option', {
          name: 'False',
        })
      );

      router.navigate(`${router.location.pathname}?query=${filter}:false`);
      rerender(<OrganizationMembersList />);
      expect(searchMock).toHaveBeenLastCalledWith(
        '/organizations/org-slug/members/',
        expect.objectContaining({
          method: 'GET',
          query: {query: `${filter}:false`},
        })
      );

      await userEvent.click(
        within(filterSection).getByRole('option', {
          name: 'All',
        })
      );
    }
  });

  describe('OrganizationInviteRequests', () => {
    const inviteRequest = MemberFixture({
      id: '123',
      user: null,
      inviteStatus: 'requested_to_be_invited',
      inviterName: UserFixture().name,
      role: 'member',
      teams: [],
    });
    const joinRequest = MemberFixture({
      id: '456',
      user: null,
      email: 'test@gmail.com',
      inviteStatus: 'requested_to_join',
      role: 'member',
      teams: [],
    });

    it('disable buttons for no access', async () => {
      const org = OrganizationFixture({
        status: {
          id: 'active',
          name: 'active',
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

      render(<OrganizationMembersList />, {
        organization: org,
      });

      expect(await screen.findByText('Pending Members')).toBeInTheDocument();
      expect(screen.getByRole('button', {name: 'Approve'})).toBeDisabled();
    });

    it('can approve invite request and update', async () => {
      const org = OrganizationFixture({
        access: ['member:admin', 'org:admin', 'member:write'],
        status: {
          id: 'active',
          name: 'active',
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

      render(<OrganizationMembersList />, {
        organization: org,
      });

      expect(await screen.findByText('Pending Members')).toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', {name: 'Approve'}));

      renderGlobalModal();
      await userEvent.click(screen.getByTestId('confirm-button'));

      expect(screen.queryByText('Pending Members')).not.toBeInTheDocument();

      expect(trackAnalytics).toHaveBeenCalledWith('invite_request.approved', {
        invite_status: inviteRequest.inviteStatus,
        member_id: parseInt(inviteRequest.id, 10),
        organization: org,
      });
    });

    it('can deny invite request and remove', async () => {
      const org = OrganizationFixture({
        access: ['member:admin', 'org:admin', 'member:write'],
        status: {
          id: 'active',
          name: 'active',
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

      render(<OrganizationMembersList />, {
        organization: org,
      });

      expect(await screen.findByText('Pending Members')).toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', {name: 'Deny'}));

      expect(screen.queryByText('Pending Members')).not.toBeInTheDocument();

      expect(trackAnalytics).toHaveBeenCalledWith('invite_request.denied', {
        invite_status: joinRequest.inviteStatus,
        member_id: parseInt(joinRequest.id, 10),
        organization: org,
      });
    });

    it('can update invite requests', async () => {
      const org = OrganizationFixture({
        access: ['member:admin', 'org:admin', 'member:write'],
        status: {
          id: 'active',
          name: 'active',
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

      render(<OrganizationMembersList />, {
        organization: org,
      });

      expect(await screen.findByText('Pending Members')).toBeInTheDocument();
      await selectEvent.select(screen.getByRole('textbox', {name: 'Role: Member'}), [
        'Admin',
      ]);

      await userEvent.click(screen.getByRole('button', {name: 'Approve'}));

      renderGlobalModal();
      await userEvent.click(screen.getByTestId('confirm-button'));

      expect(updateWithApprove).toHaveBeenCalledWith(
        `/organizations/org-slug/invite-requests/${inviteRequest.id}/`,
        expect.objectContaining({data: expect.objectContaining({role: 'admin'})})
      );
    });
  });

  describe('Org Access Requests', () => {
    it('can invite member', async () => {
      const inviteOrg = OrganizationFixture({
        features: ['invite-members'],
        access: ['member:admin', 'org:admin', 'member:write'],
        status: {
          id: 'active',
          name: 'active',
        },
      });

      render(<OrganizationMembersList />, {
        organization: inviteOrg,
      });
      renderGlobalModal();

      await userEvent.click(await screen.findByRole('button', {name: 'Invite Members'}));
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('can not invite members without the invite-members feature', async () => {
      const org = OrganizationFixture({
        features: [],
        access: ['member:admin', 'org:admin', 'member:write'],
        status: {
          id: 'active',
          name: 'active',
        },
      });

      render(<OrganizationMembersList />, {
        organization: org,
      });

      expect(await screen.findByRole('button', {name: 'Invite Members'})).toBeDisabled();
    });

    it('cannot invite members if SSO is required', async () => {
      const org = OrganizationFixture({
        features: ['invite-members'],
        access: [],
        status: {
          id: 'active',
          name: 'active',
        },
        requiresSso: true,
      });

      render(<OrganizationMembersList />, {
        organization: org,
      });

      await userEvent.click(screen.getByRole('button', {name: 'Invite Members'}));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('can invite without permissions', async () => {
      const org = OrganizationFixture({
        features: ['invite-members'],
        access: [],
        status: {
          id: 'active',
          name: 'active',
        },
      });

      render(<OrganizationMembersList />, {
        organization: org,
      });
      renderGlobalModal();

      await userEvent.click(await screen.findByRole('button', {name: 'Invite Members'}));
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('renders member list', async () => {
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/members/',
        method: 'GET',
        body: [member],
      });
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/prompts-activity/',
        method: 'GET',
        body: {},
      });
      render(<OrganizationMembersList />, {
        organization,
      });
      renderGlobalModal();

      expect(await screen.findByText('Members')).toBeInTheDocument();
      expect(screen.getByText(member.name)).toBeInTheDocument();
    });

    it('renders only current user in demo mode', async () => {
      (isDemoModeActive as jest.Mock).mockReturnValue(true);

      render(<OrganizationMembersList />, {
        organization,
      });
      renderGlobalModal();

      expect(await screen.findByText('Members')).toBeInTheDocument();
      expect(screen.getByText(currentUser.name)).toBeInTheDocument();
      expect(screen.queryByText(member.name)).not.toBeInTheDocument();

      (isDemoModeActive as jest.Mock).mockReset();
    });

    it('allows you to leave as a member after searching', async () => {
      const searchQuery = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/members/',
        method: 'GET',
        body: [currentUser],
        match: [MockApiClient.matchQuery({query: currentUser.name})],
      });
      const ownerQuery = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/members/',
        method: 'GET',
        body: [members[2]],
        match: [MockApiClient.matchQuery({query: 'role:owner isInvited:false'})],
      });
      render(<OrganizationMembersList />, {
        organization,
        initialRouterConfig: {
          location: {
            pathname: `/organizations/${organization.slug}/settings/members/`,
            query: {query: currentUser.name},
          },
          route: '/organizations/:orgId/settings/members/',
        },
      });
      renderGlobalModal();

      expect(await screen.findByText('Members')).toBeInTheDocument();
      expect(searchQuery).toHaveBeenCalled();
      expect(ownerQuery).toHaveBeenCalled();
      const leaveButton = screen.getByRole('button', {name: 'Leave'});
      expect(leaveButton).toBeEnabled();
    });
  });
});
