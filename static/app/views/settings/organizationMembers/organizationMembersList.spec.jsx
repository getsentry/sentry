import {browserHistory} from 'react-router';
import selectEvent from 'react-select-event';

import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
  waitForElementToBeRemoved,
} from 'sentry-test/reactTestingLibrary';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {Client} from 'sentry/api';
import ConfigStore from 'sentry/stores/configStore';
import OrganizationsStore from 'sentry/stores/organizationsStore';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import OrganizationMembersList from 'sentry/views/settings/organizationMembers/organizationMembersList';

jest.mock('sentry/utils/analytics/trackAdvancedAnalyticsEvent', () => jest.fn());

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
];

describe('OrganizationMembersList', function () {
  const members = TestStubs.Members();
  const currentUser = members[1];
  const defaultProps = {
    orgId: 'org-slug',
    orgName: 'Organization Name',
    status: '',
    router: {routes: []},
    requireLink: false,
    memberCanLeave: false,
    canAddMembers: false,
    canRemoveMembers: false,
    currentUser,
    onSendInvite: () => {},
    onRemove: () => {},
    onLeave: () => {},
    location: {query: {}},
  };
  const organization = TestStubs.Organization({
    access: ['member:admin', 'org:admin', 'member:write'],
    status: {
      id: 'active',
    },
  });

  jest.spyOn(ConfigStore, 'get').mockImplementation(() => currentUser);

  afterAll(function () {
    ConfigStore.get.mockRestore();
  });

  beforeEach(function () {
    Client.clearMockResponses();
    Client.addMockResponse({
      url: '/organizations/org-id/members/me/',
      method: 'GET',
      body: {roles},
    });
    Client.addMockResponse({
      url: '/organizations/org-id/members/',
      method: 'GET',
      body: TestStubs.Members(),
    });
    Client.addMockResponse({
      url: '/organizations/org-id/access-requests/',
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
    Client.addMockResponse({
      url: '/organizations/org-id/auth-provider/',
      method: 'GET',
      body: {
        ...TestStubs.AuthProvider(),
        require_link: true,
      },
    });
    Client.addMockResponse({
      url: '/organizations/org-id/teams/',
      method: 'GET',
      body: TestStubs.Team(),
    });
    Client.addMockResponse({
      url: '/organizations/org-id/invite-requests/',
      method: 'GET',
      body: [],
    });
    browserHistory.push.mockReset();
    OrganizationsStore.load([organization]);
  });

  it('can remove a member', async function () {
    const deleteMock = MockApiClient.addMockResponse({
      url: `/organizations/org-id/members/${members[0].id}/`,
      method: 'DELETE',
    });

    render(<OrganizationMembersList {...defaultProps} params={{orgId: 'org-id'}} />, {
      context: TestStubs.routerContext([{organization}]),
    });

    userEvent.click(screen.getAllByRole('button', {name: 'Remove'})[0]);

    renderGlobalModal();
    userEvent.click(screen.getByTestId('confirm-button'));

    await waitFor(() => expect(addSuccessMessage).toHaveBeenCalled());

    expect(deleteMock).toHaveBeenCalled();
    expect(browserHistory.push).not.toHaveBeenCalled();
    expect(OrganizationsStore.getAll()).toEqual([organization]);
  });

  it('displays error message when failing to remove member', async function () {
    const deleteMock = MockApiClient.addMockResponse({
      url: `/organizations/org-id/members/${members[0].id}/`,
      method: 'DELETE',
      statusCode: 500,
    });

    render(<OrganizationMembersList {...defaultProps} params={{orgId: 'org-id'}} />, {
      context: TestStubs.routerContext([{organization}]),
    });

    userEvent.click(screen.getAllByRole('button', {name: 'Remove'})[0]);

    renderGlobalModal();
    userEvent.click(screen.getByTestId('confirm-button'));

    await waitFor(() => expect(addErrorMessage).toHaveBeenCalled());

    expect(deleteMock).toHaveBeenCalled();
    expect(browserHistory.push).not.toHaveBeenCalled();
    expect(OrganizationsStore.getAll()).toEqual([organization]);
  });

  it('can leave org', async function () {
    const deleteMock = Client.addMockResponse({
      url: `/organizations/org-id/members/${members[1].id}/`,
      method: 'DELETE',
    });

    render(<OrganizationMembersList {...defaultProps} params={{orgId: 'org-id'}} />, {
      context: TestStubs.routerContext([{organization}]),
    });

    userEvent.click(screen.getAllByRole('button', {name: 'Leave'})[0]);

    renderGlobalModal();
    userEvent.click(screen.getByTestId('confirm-button'));

    await waitFor(() => expect(addSuccessMessage).toHaveBeenCalled());

    expect(deleteMock).toHaveBeenCalled();
    expect(browserHistory.push).toHaveBeenCalledTimes(1);
    expect(browserHistory.push).toHaveBeenCalledWith('/organizations/new/');
  });

  it('can redirect to remaining org after leaving', async function () {
    const deleteMock = Client.addMockResponse({
      url: `/organizations/org-id/members/${members[1].id}/`,
      method: 'DELETE',
    });
    const secondOrg = TestStubs.Organization({
      slug: 'org-two',
      status: {
        id: 'active',
      },
    });
    OrganizationsStore.addOrReplace(secondOrg);

    render(<OrganizationMembersList {...defaultProps} params={{orgId: 'org-id'}} />, {
      context: TestStubs.routerContext([{organization}]),
    });

    userEvent.click(screen.getAllByRole('button', {name: 'Leave'})[0]);

    renderGlobalModal();
    userEvent.click(screen.getByTestId('confirm-button'));

    await waitFor(() => expect(addSuccessMessage).toHaveBeenCalled());

    expect(deleteMock).toHaveBeenCalled();
    expect(browserHistory.push).toHaveBeenCalledTimes(1);
    expect(browserHistory.push).toHaveBeenCalledWith(`/${secondOrg.slug}/`);
    expect(OrganizationsStore.getAll()).toEqual([secondOrg]);
  });

  it('displays error message when failing to leave org', async function () {
    const deleteMock = Client.addMockResponse({
      url: `/organizations/org-id/members/${members[1].id}/`,
      method: 'DELETE',
      statusCode: 500,
    });

    render(<OrganizationMembersList {...defaultProps} params={{orgId: 'org-id'}} />, {
      context: TestStubs.routerContext([{organization}]),
    });

    userEvent.click(screen.getAllByRole('button', {name: 'Leave'})[0]);

    renderGlobalModal();
    userEvent.click(screen.getByTestId('confirm-button'));

    await waitFor(() => expect(addErrorMessage).toHaveBeenCalled());

    expect(deleteMock).toHaveBeenCalled();
    expect(browserHistory.push).not.toHaveBeenCalled();
    expect(OrganizationsStore.getAll()).toEqual([organization]);
  });

  it('can re-send SSO link to member', function () {
    const inviteMock = MockApiClient.addMockResponse({
      url: `/organizations/org-id/members/${members[0].id}/`,
      method: 'PUT',
      body: {
        id: '1234',
      },
    });

    render(<OrganizationMembersList {...defaultProps} params={{orgId: 'org-id'}} />, {
      context: TestStubs.routerContext([{organization}]),
    });

    expect(inviteMock).not.toHaveBeenCalled();

    userEvent.click(screen.getByRole('button', {name: 'Resend SSO link'}));
    expect(inviteMock).toHaveBeenCalled();
  });

  it('can re-send invite to member', function () {
    const inviteMock = MockApiClient.addMockResponse({
      url: `/organizations/org-id/members/${members[1].id}/`,
      method: 'PUT',
      body: {
        id: '1234',
      },
    });

    render(<OrganizationMembersList {...defaultProps} params={{orgId: 'org-id'}} />, {
      context: TestStubs.routerContext([{organization}]),
    });

    expect(inviteMock).not.toHaveBeenCalled();

    userEvent.click(screen.getByRole('button', {name: 'Resend invite'}));
    expect(inviteMock).toHaveBeenCalled();
  });

  it('can search organization members', function () {
    const searchMock = MockApiClient.addMockResponse({
      url: '/organizations/org-id/members/',
      body: [],
    });

    const routerContext = TestStubs.routerContext();

    render(<OrganizationMembersList {...defaultProps} params={{orgId: 'org-id'}} />, {
      context: routerContext,
    });

    userEvent.type(screen.getByPlaceholderText('Search Members'), 'member');

    expect(searchMock).toHaveBeenLastCalledWith(
      '/organizations/org-id/members/',
      expect.objectContaining({
        method: 'GET',
        query: {
          query: 'member',
        },
      })
    );

    userEvent.keyboard('{enter}');

    expect(routerContext.context.router.push).toHaveBeenCalledTimes(1);
  });

  it('can filter members', function () {
    const searchMock = MockApiClient.addMockResponse({
      url: '/organizations/org-id/members/',
      body: [],
    });
    const routerContext = TestStubs.routerContext();
    render(<OrganizationMembersList {...defaultProps} params={{orgId: 'org-id'}} />, {
      context: routerContext,
    });

    userEvent.click(screen.getByRole('button', {name: 'Filter'}));
    userEvent.click(screen.getByRole('checkbox', {name: 'Member'}));

    expect(searchMock).toHaveBeenLastCalledWith(
      '/organizations/org-id/members/',
      expect.objectContaining({
        method: 'GET',
        query: {query: 'role:member'},
      })
    );

    userEvent.click(screen.getByRole('checkbox', {name: 'Member'}));

    for (const [filter, label] of [
      ['isInvited', 'Invited'],
      ['has2fa', '2FA'],
      ['ssoLinked', 'SSO Linked'],
    ]) {
      userEvent.click(screen.getByRole('checkbox', {name: `Enable ${label} filter`}));

      expect(searchMock).toHaveBeenLastCalledWith(
        '/organizations/org-id/members/',
        expect.objectContaining({
          method: 'GET',
          query: {query: `${filter}:true`},
        })
      );

      userEvent.click(screen.getByRole('checkbox', {name: `Toggle ${label}`}));

      expect(searchMock).toHaveBeenLastCalledWith(
        '/organizations/org-id/members/',
        expect.objectContaining({
          method: 'GET',
          query: {query: `${filter}:false`},
        })
      );

      userEvent.click(screen.getByRole('checkbox', {name: `Enable ${label} filter`}));
    }
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
        url: '/organizations/org-id/invite-requests/',
        method: 'GET',
        body: [inviteRequest],
      });
      MockApiClient.addMockResponse({
        url: `/organizations/org-id/invite-requests/${inviteRequest.id}/`,
        method: 'PUT',
      });

      render(
        <OrganizationMembersList
          {...defaultProps}
          params={{orgId: 'org-id'}}
          organization={org}
        />,
        {context: TestStubs.routerContext([{organization: org}])}
      );

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
        url: '/organizations/org-id/invite-requests/',
        method: 'GET',
        body: [inviteRequest],
      });
      MockApiClient.addMockResponse({
        url: `/organizations/org-id/invite-requests/${inviteRequest.id}/`,
        method: 'PUT',
      });

      render(
        <OrganizationMembersList
          {...defaultProps}
          params={{orgId: 'org-id'}}
          organization={org}
        />,
        {context: TestStubs.routerContext([{organization: org}])}
      );

      expect(screen.getByText('Pending Members')).toBeInTheDocument();

      userEvent.click(screen.getByRole('button', {name: 'Approve'}));

      renderGlobalModal();
      userEvent.click(screen.getByTestId('confirm-button'));

      await waitForElementToBeRemoved(() => screen.queryByText('Pending Members'));

      expect(trackAdvancedAnalyticsEvent).toHaveBeenCalledWith(
        'invite_request.approved',
        {
          invite_status: inviteRequest.inviteStatus,
          member_id: parseInt(inviteRequest.id, 10),
          organization: org,
        }
      );
    });

    it('can deny invite request and remove', async function () {
      const org = TestStubs.Organization({
        access: ['member:admin', 'org:admin', 'member:write'],
        status: {
          id: 'active',
        },
      });
      MockApiClient.addMockResponse({
        url: '/organizations/org-id/invite-requests/',
        method: 'GET',
        body: [joinRequest],
      });
      MockApiClient.addMockResponse({
        url: `/organizations/org-id/invite-requests/${joinRequest.id}/`,
        method: 'DELETE',
      });

      render(
        <OrganizationMembersList
          {...defaultProps}
          params={{orgId: 'org-id'}}
          organization={org}
        />,
        {context: TestStubs.routerContext([{organization: org}])}
      );

      expect(screen.getByText('Pending Members')).toBeInTheDocument();

      userEvent.click(screen.getByRole('button', {name: 'Deny'}));

      await waitForElementToBeRemoved(() => screen.queryByText('Pending Members'));

      expect(trackAdvancedAnalyticsEvent).toHaveBeenCalledWith('invite_request.denied', {
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
        url: '/organizations/org-id/invite-requests/',
        method: 'GET',
        body: [inviteRequest],
      });

      const updateWithApprove = MockApiClient.addMockResponse({
        url: `/organizations/org-id/invite-requests/${inviteRequest.id}/`,
        method: 'PUT',
      });

      render(
        <OrganizationMembersList
          {...defaultProps}
          params={{orgId: 'org-id'}}
          organization={org}
        />,
        {context: TestStubs.routerContext([{organization: org}])}
      );

      await selectEvent.select(screen.getAllByRole('textbox')[1], ['Admin']);

      userEvent.click(screen.getByRole('button', {name: 'Approve'}));

      renderGlobalModal();
      userEvent.click(screen.getByTestId('confirm-button'));

      expect(updateWithApprove).toHaveBeenCalledWith(
        `/organizations/org-id/invite-requests/${inviteRequest.id}/`,
        expect.objectContaining({data: expect.objectContaining({role: 'admin'})})
      );
    });
  });
});
