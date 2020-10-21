import {browserHistory} from 'react-router';

import {mountWithTheme} from 'sentry-test/enzyme';

import {Client} from 'app/api';
import ConfigStore from 'app/stores/configStore';
import OrganizationMembersList from 'app/views/settings/organizationMembers/organizationMembersList';
import OrganizationsStore from 'app/stores/organizationsStore';
import {addSuccessMessage, addErrorMessage} from 'app/actionCreators/indicator';

jest.mock('app/api');
jest.mock('app/actionCreators/indicator');

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
    browserHistory.push.mockReset();
    OrganizationsStore.load([organization]);
  });

  it('can remove a member', async function () {
    const deleteMock = MockApiClient.addMockResponse({
      url: `/organizations/org-id/members/${members[0].id}/`,
      method: 'DELETE',
    });

    const wrapper = mountWithTheme(
      <OrganizationMembersList {...defaultProps} params={{orgId: 'org-id'}} />,
      TestStubs.routerContext([{organization}])
    );

    wrapper.find('Button[data-test-id="remove"]').at(0).simulate('click');

    await tick();

    // Confirm modal
    wrapper.find('ModalDialog Button[priority="primary"]').simulate('click');
    await tick();

    expect(deleteMock).toHaveBeenCalled();
    expect(addSuccessMessage).toHaveBeenCalled();

    expect(browserHistory.push).not.toHaveBeenCalled();
    expect(OrganizationsStore.getAll()).toEqual([organization]);
  });

  it('displays error message when failing to remove member', async function () {
    const deleteMock = MockApiClient.addMockResponse({
      url: `/organizations/org-id/members/${members[0].id}/`,
      method: 'DELETE',
      statusCode: 500,
    });

    const wrapper = mountWithTheme(
      <OrganizationMembersList {...defaultProps} params={{orgId: 'org-id'}} />,
      TestStubs.routerContext([{organization}])
    );

    wrapper.find('Button[data-test-id="remove"]').at(0).simulate('click');

    await tick();

    // Confirm modal
    wrapper.find('ModalDialog Button[priority="primary"]').simulate('click');
    await tick();
    expect(deleteMock).toHaveBeenCalled();
    await tick();
    expect(addErrorMessage).toHaveBeenCalled();

    expect(browserHistory.push).not.toHaveBeenCalled();
    expect(OrganizationsStore.getAll()).toEqual([organization]);
  });

  it('can leave org', async function () {
    const deleteMock = Client.addMockResponse({
      url: `/organizations/org-id/members/${members[1].id}/`,
      method: 'DELETE',
    });

    const wrapper = mountWithTheme(
      <OrganizationMembersList {...defaultProps} params={{orgId: 'org-id'}} />,
      TestStubs.routerContext([{organization}])
    );

    wrapper.find('Button[priority="danger"]').at(0).simulate('click');

    await tick();

    // Confirm modal
    wrapper.find('ModalDialog Button[priority="primary"]').simulate('click');
    await tick();

    expect(deleteMock).toHaveBeenCalled();
    expect(addSuccessMessage).toHaveBeenCalled();

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
    OrganizationsStore.add(secondOrg);

    const wrapper = mountWithTheme(
      <OrganizationMembersList {...defaultProps} params={{orgId: 'org-id'}} />,
      TestStubs.routerContext([{organization}])
    );

    wrapper.find('Button[priority="danger"]').at(0).simulate('click');

    await tick();

    // Confirm modal
    wrapper.find('ModalDialog Button[priority="primary"]').simulate('click');
    await tick();

    expect(deleteMock).toHaveBeenCalled();
    expect(addSuccessMessage).toHaveBeenCalled();

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

    const wrapper = mountWithTheme(
      <OrganizationMembersList {...defaultProps} params={{orgId: 'org-id'}} />,
      TestStubs.routerContext([{organization}])
    );

    wrapper.find('Button[priority="danger"]').at(0).simulate('click');

    await tick();

    // Confirm modal
    wrapper.find('ModalDialog Button[priority="primary"]').simulate('click');
    await tick();
    expect(deleteMock).toHaveBeenCalled();
    await tick();
    expect(addErrorMessage).toHaveBeenCalled();

    expect(browserHistory.push).not.toHaveBeenCalled();
    expect(OrganizationsStore.getAll()).toEqual([organization]);
  });

  it('can re-send SSO link to member', async function () {
    const inviteMock = MockApiClient.addMockResponse({
      url: `/organizations/org-id/members/${members[0].id}/`,
      method: 'PUT',
      body: {
        id: '1234',
      },
    });

    const wrapper = mountWithTheme(
      <OrganizationMembersList {...defaultProps} params={{orgId: 'org-id'}} />,
      TestStubs.routerContext([{organization}])
    );

    expect(inviteMock).not.toHaveBeenCalled();

    wrapper.find('StyledButton[aria-label="Resend SSO link"]').simulate('click');

    await tick();
    expect(inviteMock).toHaveBeenCalled();
  });

  it('can re-send invite to member', async function () {
    const inviteMock = MockApiClient.addMockResponse({
      url: `/organizations/org-id/members/${members[1].id}/`,
      method: 'PUT',
      body: {
        id: '1234',
      },
    });

    const wrapper = mountWithTheme(
      <OrganizationMembersList {...defaultProps} params={{orgId: 'org-id'}} />,
      TestStubs.routerContext([{organization}])
    );

    expect(inviteMock).not.toHaveBeenCalled();

    wrapper.find('StyledButton[aria-label="Resend invite"]').simulate('click');

    await tick();
    expect(inviteMock).toHaveBeenCalled();
  });

  it('can search organization members', async function () {
    const searchMock = MockApiClient.addMockResponse({
      url: '/organizations/org-id/members/',
      body: [],
    });
    const routerContext = TestStubs.routerContext();
    const wrapper = mountWithTheme(
      <OrganizationMembersList {...defaultProps} params={{orgId: 'org-id'}} />,
      routerContext
    );

    wrapper
      .find('AsyncComponentSearchInput input')
      .simulate('change', {target: {value: 'member'}});

    expect(searchMock).toHaveBeenLastCalledWith(
      '/organizations/org-id/members/',
      expect.objectContaining({
        method: 'GET',
        query: {
          query: 'member',
        },
      })
    );

    wrapper.find('SearchWrapper form').simulate('submit');

    expect(routerContext.context.router.push).toHaveBeenCalledTimes(1);
  });

  it('can filter members', async function () {
    const searchMock = MockApiClient.addMockResponse({
      url: '/organizations/org-id/members/',
      body: [],
    });
    const routerContext = TestStubs.routerContext();
    const wrapper = mountWithTheme(
      <OrganizationMembersList {...defaultProps} params={{orgId: 'org-id'}} />,
      routerContext
    );

    wrapper.find('AsyncComponentSearchInput DropdownMenu Button').simulate('click');

    wrapper
      .find('AsyncComponentSearchInput [data-test-id="filter-role-member"] input')
      .simulate('change', {target: {checked: true}});

    expect(searchMock).toHaveBeenLastCalledWith(
      '/organizations/org-id/members/',
      expect.objectContaining({
        method: 'GET',
        query: {query: 'role:member'},
      })
    );

    wrapper
      .find('AsyncComponentSearchInput [data-test-id="filter-role-member"] input')
      .simulate('change', {target: {checked: false}});

    for (const filter of ['isInvited', 'has2fa', 'ssoLinked']) {
      wrapper
        .find(`AsyncComponentSearchInput [data-test-id="filter-${filter}"] input`)
        .simulate('change', {target: {checked: true}});

      expect(searchMock).toHaveBeenLastCalledWith(
        '/organizations/org-id/members/',
        expect.objectContaining({
          method: 'GET',
          query: {query: `${filter}:true`},
        })
      );

      wrapper
        .find(`AsyncComponentSearchInput [data-test-id="filter-${filter}"] Switch`)
        .simulate('click');

      expect(searchMock).toHaveBeenLastCalledWith(
        '/organizations/org-id/members/',
        expect.objectContaining({
          method: 'GET',
          query: {query: `${filter}:false`},
        })
      );

      wrapper
        .find(`AsyncComponentSearchInput [data-test-id="filter-${filter}"] input`)
        .simulate('change', {target: {checked: false}});
    }
  });
});
