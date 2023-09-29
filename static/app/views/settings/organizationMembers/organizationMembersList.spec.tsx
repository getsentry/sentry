import {browserHistory} from 'react-router';
import selectEvent from 'react-select-event';
import {AuthProvider} from 'sentry-fixture/authProvider';
import {Members} from 'sentry-fixture/members';

import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import ConfigStore from 'sentry/stores/configStore';
import OrganizationsStore from 'sentry/stores/organizationsStore';
import {trackAnalytics} from 'sentry/utils/analytics';
import OrganizationMembersList from 'sentry/views/settings/organizationMembers/organizationMembersList';

jest.mock('sentry/utils/analytics');

jest.mock('sentry/api');
jest.mock('sentry/actionCreators/indicator');

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
    allowed: true,
  },
];

// const missingMembers = [
//   {
//     integration: 'github',
//     users: TestStubs.MissingMembers(),
//   },
// ];

describe('OrganizationMembersList', function () {
  const members = TestStubs.Members();

  const ownerTeam = TestStubs.Team({slug: 'owner-team', orgRole: 'owner'});
  const member = TestStubs.Member({
    id: '5',
    email: 'member@sentry.io',
    teams: [ownerTeam.slug],
    teamRoles: [
      {
        teamSlug: ownerTeam.slug,
        role: null,
      },
    ],
    flags: {
      'sso:linked': true,
    },
    groupOrgRoles: [
      {
        teamSlug: ownerTeam.slug,
        role: {id: 'owner'},
      },
    ],
  });

  const currentUser = members[1];
  const organization = TestStubs.Organization({
    access: ['member:admin', 'org:admin', 'member:write'],
    status: {
      id: 'active',
    },
  });
  const router = TestStubs.router();
  const defaultProps = {
    organization,
    router,
    location: router.location,
    routes: router.routes,
    route: router.routes[0],
    params: router.params,
    routeParams: router.params,
  };

  jest.spyOn(ConfigStore, 'get').mockImplementation(() => currentUser);

  afterAll(function () {
    (ConfigStore.get as jest.Mock).mockRestore();
  });

  beforeEach(function () {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/members/me/',
      method: 'GET',
      body: {roles},
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/members/',
      method: 'GET',
      body: [...Members(), member],
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
          team: TestStubs.Team(),
        },
      ],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/auth-provider/',
      method: 'GET',
      body: {
        ...AuthProvider(),
        require_link: true,
      },
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/teams/',
      method: 'GET',
      body: [TestStubs.Team(), ownerTeam],
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
      url: '/prompts-activity/',
      method: 'GET',
      body: {
        dismissed_ts: undefined,
        snoozed_ts: undefined,
      },
    });
    (browserHistory.push as jest.Mock).mockReset();
    OrganizationsStore.load([organization]);
  });

  it('can remove a member', async function () {
    const deleteMock = MockApiClient.addMockResponse({
      url: `/organizations/org-slug/members/${members[0].id}/`,
      method: 'DELETE',
    });

    render(<OrganizationMembersList {...defaultProps} />, {
      context: TestStubs.routerContext([{organization}]),
    });

    await userEvent.click(screen.getAllByRole('button', {name: 'Remove'})[0]);

    renderGlobalModal();
    await userEvent.click(screen.getByTestId('confirm-button'));

    await waitFor(() => expect(addSuccessMessage).toHaveBeenCalled());

    expect(deleteMock).toHaveBeenCalled();
    expect(browserHistory.push).not.toHaveBeenCalled();
    expect(OrganizationsStore.getAll()).toEqual([organization]);
  });

  it('displays error message when failing to remove member', async function () {
    const deleteMock = MockApiClient.addMockResponse({
      url: `/organizations/org-slug/members/${members[0].id}/`,
      method: 'DELETE',
      statusCode: 500,
    });

    render(<OrganizationMembersList {...defaultProps} />, {
      context: TestStubs.routerContext([{organization}]),
    });

    await userEvent.click(screen.getAllByRole('button', {name: 'Remove'})[0]);

    renderGlobalModal();
    await userEvent.click(screen.getByTestId('confirm-button'));

    await waitFor(() => expect(addErrorMessage).toHaveBeenCalled());

    expect(deleteMock).toHaveBeenCalled();
    expect(browserHistory.push).not.toHaveBeenCalled();
    expect(OrganizationsStore.getAll()).toEqual([organization]);
  });

  it('can leave org', async function () {
    const deleteMock = MockApiClient.addMockResponse({
      url: `/organizations/org-slug/members/${members[1].id}/`,
      method: 'DELETE',
    });

    render(<OrganizationMembersList {...defaultProps} />, {
      context: TestStubs.routerContext([{organization}]),
    });

    await userEvent.click(screen.getAllByRole('button', {name: 'Leave'})[0]);

    renderGlobalModal();
    await userEvent.click(screen.getByTestId('confirm-button'));

    await waitFor(() => expect(addSuccessMessage).toHaveBeenCalled());

    expect(deleteMock).toHaveBeenCalled();
    expect(browserHistory.push).toHaveBeenCalledTimes(1);
    expect(browserHistory.push).toHaveBeenCalledWith('/organizations/new/');
  });

  it('can redirect to remaining org after leaving', async function () {
    const deleteMock = MockApiClient.addMockResponse({
      url: `/organizations/org-slug/members/${members[1].id}/`,
      method: 'DELETE',
    });
    const secondOrg = TestStubs.Organization({
      slug: 'org-two',
      status: {
        id: 'active',
      },
    });
    OrganizationsStore.addOrReplace(secondOrg);

    render(<OrganizationMembersList {...defaultProps} />, {
      context: TestStubs.routerContext([{organization}]),
    });

    await userEvent.click(screen.getAllByRole('button', {name: 'Leave'})[0]);

    renderGlobalModal();
    await userEvent.click(screen.getByTestId('confirm-button'));

    await waitFor(() => expect(addSuccessMessage).toHaveBeenCalled());

    expect(deleteMock).toHaveBeenCalled();
    expect(browserHistory.push).toHaveBeenCalledTimes(1);
    expect(browserHistory.push).toHaveBeenCalledWith(
      `/organizations/${secondOrg.slug}/issues/`
    );
    expect(OrganizationsStore.getAll()).toEqual([secondOrg]);
  });

  it('displays error message when failing to leave org', async function () {
    const deleteMock = MockApiClient.addMockResponse({
      url: `/organizations/org-slug/members/${members[1].id}/`,
      method: 'DELETE',
      statusCode: 500,
    });

    render(<OrganizationMembersList {...defaultProps} />, {
      context: TestStubs.routerContext([{organization}]),
    });

    await userEvent.click(screen.getAllByRole('button', {name: 'Leave'})[0]);

    renderGlobalModal();
    await userEvent.click(screen.getByTestId('confirm-button'));

    await waitFor(() => expect(addErrorMessage).toHaveBeenCalled());

    expect(deleteMock).toHaveBeenCalled();
    expect(browserHistory.push).not.toHaveBeenCalled();
    expect(OrganizationsStore.getAll()).toEqual([organization]);
  });

  it('can re-send SSO link to member', async function () {
    const inviteMock = MockApiClient.addMockResponse({
      url: `/organizations/org-slug/members/${members[0].id}/`,
      method: 'PUT',
      body: {
        id: '1234',
      },
    });

    render(<OrganizationMembersList {...defaultProps} />, {
      context: TestStubs.routerContext([{organization}]),
    });

    expect(inviteMock).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', {name: 'Resend SSO link'}));
    expect(inviteMock).toHaveBeenCalled();
  });

  it('can re-send invite to member', async function () {
    const inviteMock = MockApiClient.addMockResponse({
      url: `/organizations/org-slug/members/${members[1].id}/`,
      method: 'PUT',
      body: {
        id: '1234',
      },
    });

    render(<OrganizationMembersList {...defaultProps} />, {
      context: TestStubs.routerContext([{organization}]),
    });

    expect(inviteMock).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', {name: 'Resend invite'}));
    expect(inviteMock).toHaveBeenCalled();
  });

  it('can search organization members', async function () {
    const searchMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/members/',
      body: [],
    });

    const routerContext = TestStubs.routerContext();

    render(<OrganizationMembersList {...defaultProps} />, {
      context: routerContext,
    });

    await userEvent.type(screen.getByPlaceholderText('Search Members'), 'member');

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

    expect(routerContext.context.router.push).toHaveBeenCalledTimes(1);
  });

  it('can filter members', async function () {
    const searchMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/members/',
      body: [],
    });
    const routerContext = TestStubs.routerContext();
    render(<OrganizationMembersList {...defaultProps} />, {
      context: routerContext,
    });

    await userEvent.click(screen.getByRole('button', {name: 'Filter'}));
    await userEvent.click(screen.getByRole('option', {name: 'Member'}));

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

  it('can filter members with org roles from team membership', async function () {
    const routerContext = TestStubs.routerContext();
    render(<OrganizationMembersList {...defaultProps} />, {
      context: routerContext,
    });

    await userEvent.click(screen.getByRole('button', {name: 'Filter'}));
    await userEvent.click(screen.getByRole('option', {name: 'Owner'}));
    await userEvent.click(screen.getByRole('button', {name: 'Filter'}));

    const owners = screen.queryAllByText('Owner');
    expect(owners).toHaveLength(3);
  });

  describe('OrganizationInviteRequests', function () {
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

    it('disable buttons for no access', function () {
      const org = TestStubs.Organization({
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

      render(<OrganizationMembersList {...defaultProps} organization={org} />, {
        context: TestStubs.routerContext([{organization: org}]),
      });

      expect(screen.getByText('Pending Members')).toBeInTheDocument();
      expect(screen.getByRole('button', {name: 'Approve'})).toBeDisabled();
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

      render(<OrganizationMembersList {...defaultProps} />, {
        context: TestStubs.routerContext([{organization: org}]),
      });

      expect(screen.getByText('Pending Members')).toBeInTheDocument();

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

      render(<OrganizationMembersList {...defaultProps} />, {
        context: TestStubs.routerContext([{organization: org}]),
      });

      expect(screen.getByText('Pending Members')).toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', {name: 'Deny'}));

      expect(screen.queryByText('Pending Members')).not.toBeInTheDocument();

      expect(trackAnalytics).toHaveBeenCalledWith('invite_request.denied', {
        invite_status: joinRequest.inviteStatus,
        member_id: parseInt(joinRequest.id, 10),
        organization: org,
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

      render(<OrganizationMembersList {...defaultProps} />, {
        context: TestStubs.routerContext([{organization: org}]),
      });

      await selectEvent.select(screen.getAllByRole('textbox')[1], ['Admin']);

      await userEvent.click(screen.getByRole('button', {name: 'Approve'}));

      renderGlobalModal();
      await userEvent.click(screen.getByTestId('confirm-button'));

      expect(updateWithApprove).toHaveBeenCalledWith(
        `/organizations/org-slug/invite-requests/${inviteRequest.id}/`,
        expect.objectContaining({data: expect.objectContaining({role: 'admin'})})
      );
    });
  });

  // TODO(cathy): uncomment

  // describe('inviteBanner', function () {
  //   it('invites member from banner', async function () {
  //     MockApiClient.addMockResponse({
  //       url: '/organizations/org-slug/missing-members/',
  //       method: 'GET',
  //       body: missingMembers,
  //     });

  //     const newMember = TestStubs.Member({
  //       id: '6',
  //       email: 'hello@sentry.io',
  //       teams: [],
  //       teamRoles: [],
  //       flags: {
  //         'sso:linked': true,
  //         'idp:provisioned': false,
  //       },
  //     });

  //     MockApiClient.addMockResponse({
  //       url: '/organizations/org-slug/members/?referrer=github_nudge_invite',
  //       method: 'POST',
  //       body: newMember,
  //     });

  //     const org = TestStubs.Organization({
  //       features: ['integrations-gh-invite'],
  //       githubNudgeInvite: true,
  //     });

  //     render(<OrganizationMembersList {...defaultProps} organization={org} />, {
  //       context: TestStubs.routerContext([{organization: org}]),
  //     });

  //     expect(
  //       await screen.findByRole('heading', {
  //         name: 'Bring your full GitHub team on board in Sentry',
  //       })
  //     ).toBeInTheDocument();
  //     expect(screen.queryAllByTestId('invite-missing-member')).toHaveLength(5);
  //     expect(screen.getByText('See all 5 missing members')).toBeInTheDocument();

  //     const inviteButton = screen.queryAllByTestId('invite-missing-member')[0];
  //     await userEvent.click(inviteButton);
  //     expect(screen.queryAllByTestId('invite-missing-member')).toHaveLength(4);
  //     expect(screen.getByText('See all 4 missing members')).toBeInTheDocument();
  //   });
  // });
});
