import {AuthProviderFixture} from 'sentry-fixture/authProvider';
import {MemberFixture} from 'sentry-fixture/member';
import {MembersFixture} from 'sentry-fixture/members';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {RouterFixture} from 'sentry-fixture/routerFixture';
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
import ModalStore from 'sentry/stores/modalStore';
import OrganizationsStore from 'sentry/stores/organizationsStore';
import {trackAnalytics} from 'sentry/utils/analytics';
import OrganizationMembersList from 'sentry/views/settings/organizationMembers/organizationMembersList';

jest.mock('sentry/utils/analytics');
jest.mock('sentry/actionCreators/indicator');

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

describe('OrganizationMembersList', function () {
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
  const router = RouterFixture();

  beforeEach(function () {
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
    ModalStore.init();
  });

  it('can remove a member', async function () {
    const deleteMock = MockApiClient.addMockResponse({
      url: `/organizations/org-slug/members/${members[0]!.id}/`,
      method: 'DELETE',
    });

    render(<OrganizationMembersList />, {organization, router});
    renderGlobalModal({router});

    // The organization member row
    expect(await screen.findByTestId(members[0]!.email)).toBeInTheDocument();

    await userEvent.click(
      within(screen.getByTestId(members[0]!.email)).getByRole('button', {name: 'Remove'})
    );
    await userEvent.click(await screen.findByRole('button', {name: 'Confirm'}));

    await waitFor(() => expect(addSuccessMessage).toHaveBeenCalled());

    expect(deleteMock).toHaveBeenCalled();
    expect(router.push).not.toHaveBeenCalled();
    expect(OrganizationsStore.getAll()).toEqual([organization]);
  });

  it('displays error message when failing to remove member', async function () {
    const deleteMock = MockApiClient.addMockResponse({
      url: `/organizations/org-slug/members/${members[0]!.id}/`,
      method: 'DELETE',
      statusCode: 500,
    });

    render(<OrganizationMembersList />, {organization, router});
    renderGlobalModal({router});

    // The organization member row
    expect(await screen.findByTestId(members[0]!.email)).toBeInTheDocument();

    await userEvent.click(
      within(screen.getByTestId(members[0]!.email)).getByRole('button', {name: 'Remove'})
    );
    await userEvent.click(await screen.findByRole('button', {name: 'Confirm'}));

    await waitFor(() => expect(addErrorMessage).toHaveBeenCalled());

    expect(deleteMock).toHaveBeenCalled();
    expect(router.push).not.toHaveBeenCalled();
    expect(OrganizationsStore.getAll()).toEqual([organization]);
  });

  it('can leave org', async function () {
    const deleteMock = MockApiClient.addMockResponse({
      url: `/organizations/org-slug/members/${members[1]!.id}/`,
      method: 'DELETE',
    });

    render(<OrganizationMembersList />, {organization, router});
    renderGlobalModal({router});

    await userEvent.click(await screen.findByRole('button', {name: 'Leave'}));
    await userEvent.click(await screen.findByRole('button', {name: 'Confirm'}));

    await waitFor(() => expect(addSuccessMessage).toHaveBeenCalled());

    expect(deleteMock).toHaveBeenCalled();
    expect(router.push).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledWith('/organizations/new/');
  });

  it('can redirect to remaining org after leaving', async function () {
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

    render(<OrganizationMembersList />, {organization, router});
    renderGlobalModal({router});

    await userEvent.click(await screen.findByRole('button', {name: 'Leave'}));
    await userEvent.click(screen.getByTestId('confirm-button'));

    await waitFor(() => expect(addSuccessMessage).toHaveBeenCalled());

    expect(deleteMock).toHaveBeenCalled();
    expect(router.push).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledWith('/organizations/org-two/issues/');
    expect(OrganizationsStore.getAll()).toEqual([secondOrg]);
  });

  it('displays error message when failing to leave org', async function () {
    const deleteMock = MockApiClient.addMockResponse({
      url: `/organizations/org-slug/members/${members[1]!.id}/`,
      method: 'DELETE',
      statusCode: 500,
    });

    render(<OrganizationMembersList />, {organization, router});
    renderGlobalModal({router});

    await userEvent.click(await screen.findByRole('button', {name: 'Leave'}));
    await userEvent.click(await screen.findByRole('button', {name: 'Confirm'}));

    await waitFor(() => expect(addErrorMessage).toHaveBeenCalled());

    expect(deleteMock).toHaveBeenCalled();
    expect(router.push).not.toHaveBeenCalled();
    expect(OrganizationsStore.getAll()).toEqual([organization]);
  });

  it('can re-send SSO link to member', async function () {
    const inviteMock = MockApiClient.addMockResponse({
      url: `/organizations/org-slug/members/${members[0]!.id}/`,
      method: 'PUT',
      body: {
        id: '1234',
      },
    });

    render(<OrganizationMembersList />, {organization});

    expect(inviteMock).not.toHaveBeenCalled();

    await userEvent.click(await screen.findByRole('button', {name: 'Resend SSO link'}));
    expect(inviteMock).toHaveBeenCalled();
  });

  it('can re-send invite to member', async function () {
    const inviteMock = MockApiClient.addMockResponse({
      url: `/organizations/org-slug/members/${members[1]!.id}/`,
      method: 'PUT',
      body: {
        id: '1234',
      },
    });

    render(<OrganizationMembersList />, {organization});

    expect(inviteMock).not.toHaveBeenCalled();

    await userEvent.click(await screen.findByRole('button', {name: 'Resend invite'}));
    expect(inviteMock).toHaveBeenCalled();
  });

  it('can search organization members', async function () {
    const filterRouter = RouterFixture();
    const searchMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/members/',
      body: [],
    });

    const {rerender} = render(<OrganizationMembersList />, {
      router: filterRouter,
    });

    await userEvent.type(await screen.findByPlaceholderText('Search Members'), 'member');

    filterRouter.location.query = {query: 'member'};
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
      expect(filterRouter.push).toHaveBeenCalledTimes(1);
    });
  });

  it('can filter members', async function () {
    const searchMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/members/',
      body: [],
    });

    const filterRouter = RouterFixture();
    const {rerender} = render(<OrganizationMembersList />, {
      router: filterRouter,
    });

    await userEvent.click(await screen.findByRole('button', {name: 'Filter'}));
    await userEvent.click(screen.getByRole('option', {name: 'Member'}));

    filterRouter.location.query = {query: 'role:member'};
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

      filterRouter.location.query = {query: `${filter}:true`};
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

      filterRouter.location.query = {query: `${filter}:false`};
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

  describe('OrganizationInviteRequests', function () {
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

    it('disable buttons for no access', async function () {
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

      render(<OrganizationMembersList />, {organization: org});

      expect(await screen.findByText('Pending Members')).toBeInTheDocument();
      expect(screen.getByRole('button', {name: 'Approve'})).toBeDisabled();
    });

    it('can approve invite request and update', async function () {
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

      render(<OrganizationMembersList />, {organization, router});

      expect(await screen.findByText('Pending Members')).toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', {name: 'Approve'}));

      renderGlobalModal({router});
      await userEvent.click(screen.getByTestId('confirm-button'));

      expect(screen.queryByText('Pending Members')).not.toBeInTheDocument();

      expect(trackAnalytics).toHaveBeenCalledWith('invite_request.approved', {
        invite_status: inviteRequest.inviteStatus,
        member_id: parseInt(inviteRequest.id, 10),
        organization: org,
      });
    });

    it('can deny invite request and remove', async function () {
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

      render(<OrganizationMembersList />, {organization});

      expect(await screen.findByText('Pending Members')).toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', {name: 'Deny'}));

      expect(screen.queryByText('Pending Members')).not.toBeInTheDocument();

      expect(trackAnalytics).toHaveBeenCalledWith('invite_request.denied', {
        invite_status: joinRequest.inviteStatus,
        member_id: parseInt(joinRequest.id, 10),
        organization: org,
      });
    });

    it('can update invite requests', async function () {
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

      render(<OrganizationMembersList />, {organization: org, router});

      expect(await screen.findByText('Pending Members')).toBeInTheDocument();
      await selectEvent.select(screen.getByRole('textbox', {name: 'Role: Member'}), [
        'Admin',
      ]);

      await userEvent.click(screen.getByRole('button', {name: 'Approve'}));

      renderGlobalModal({router});
      await userEvent.click(screen.getByTestId('confirm-button'));

      expect(updateWithApprove).toHaveBeenCalledWith(
        `/organizations/org-slug/invite-requests/${inviteRequest.id}/`,
        expect.objectContaining({data: expect.objectContaining({role: 'admin'})})
      );
    });
  });

  describe('Org Access Requests', function () {
    it('can invite member', async function () {
      const inviteOrg = OrganizationFixture({
        features: ['invite-members'],
        access: ['member:admin', 'org:admin', 'member:write'],
        status: {
          id: 'active',
          name: 'active',
        },
      });

      render(<OrganizationMembersList />, {organization: inviteOrg, router});
      renderGlobalModal({router});

      await userEvent.click(await screen.findByRole('button', {name: 'Invite Members'}));
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('can not invite members without the invite-members feature', async function () {
      const org = OrganizationFixture({
        features: [],
        access: ['member:admin', 'org:admin', 'member:write'],
        status: {
          id: 'active',
          name: 'active',
        },
      });

      render(<OrganizationMembersList />, {organization: org, router});
      renderGlobalModal({router});

      expect(await screen.findByRole('button', {name: 'Invite Members'})).toBeDisabled();
    });

    it('cannot invite members if SSO is required', async function () {
      const org = OrganizationFixture({
        features: ['invite-members'],
        access: [],
        status: {
          id: 'active',
          name: 'active',
        },
        requiresSso: true,
      });

      render(<OrganizationMembersList />, {organization: org, router});
      renderGlobalModal({router});

      await userEvent.click(screen.getByRole('button', {name: 'Invite Members'}));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('can invite without permissions', async function () {
      const org = OrganizationFixture({
        features: ['invite-members'],
        access: [],
        status: {
          id: 'active',
          name: 'active',
        },
      });

      render(<OrganizationMembersList />, {organization: org, router});
      renderGlobalModal({router});

      await userEvent.click(await screen.findByRole('button', {name: 'Invite Members'}));
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('renders member list', async function () {
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
      render(<OrganizationMembersList />, {organization, router});
      renderGlobalModal({router});

      expect(await screen.findByText('Members')).toBeInTheDocument();
      expect(screen.getByText(member.name)).toBeInTheDocument();
    });
  });
});
