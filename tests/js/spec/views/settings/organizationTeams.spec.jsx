import {mountWithTheme} from 'sentry-test/enzyme';
import {initializeOrg} from 'sentry-test/initializeOrg';
import {act} from 'sentry-test/reactTestingLibrary';

import {openCreateTeamModal} from 'sentry/actionCreators/modal';
import TeamStore from 'sentry/stores/teamStore';
import recreateRoute from 'sentry/utils/recreateRoute';
import OrganizationTeams from 'sentry/views/settings/organizationTeams/organizationTeams';

recreateRoute.mockReturnValue('');

jest.mock('sentry/actionCreators/modal', () => ({
  openCreateTeamModal: jest.fn(),
}));

describe('OrganizationTeams', function () {
  beforeEach(function () {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/stats/',
      body: [],
    });
  });

  describe('Open Membership', function () {
    const {organization, project, routerContext} = initializeOrg({
      organization: {
        openMembership: true,
      },
    });

    const createWrapper = props =>
      mountWithTheme(
        <OrganizationTeams
          params={{orgId: organization.slug, projectId: project.slug}}
          routes={[]}
          features={new Set(['open-membership'])}
          access={new Set(['project:admin'])}
          organization={organization}
          {...props}
        />,
        routerContext
      );

    it('opens "create team modal" when creating a new team from header', function () {
      const wrapper = createWrapper();

      // Click "Create Team" in Panel Header
      wrapper.find('SettingsPageHeader Button').simulate('click');

      // action creator to open "create team modal" is called
      expect(openCreateTeamModal).toHaveBeenCalledWith(
        expect.objectContaining({
          organization: expect.objectContaining({
            slug: organization.slug,
          }),
        })
      );
    });

    it('can join team and have link to details', function () {
      const mockTeams = [TestStubs.Team({hasAccess: true, isMember: false})];
      act(() => void TeamStore.loadInitialData(mockTeams, false, null));
      const wrapper = createWrapper({
        access: new Set([]),
      });
      expect(wrapper.find('button[aria-label="Join Team"]')).toHaveLength(1);

      // Should also link to details
      expect(wrapper.find('Link')).not.toHaveLength(0);
    });
  });

  describe('Closed Membership', function () {
    const {organization, project, routerContext} = initializeOrg({
      organization: {
        openMembership: false,
      },
    });
    const createWrapper = props =>
      mountWithTheme(
        <OrganizationTeams
          params={{orgId: organization.slug, projectId: project.slug}}
          routes={[]}
          features={new Set([])}
          access={new Set([])}
          allTeams={[]}
          activeTeams={[]}
          organization={organization}
          {...props}
        />,
        routerContext
      );

    it('can request access to team and does not have link to details', function () {
      const mockTeams = [TestStubs.Team({hasAccess: false, isMember: false})];
      act(() => void TeamStore.loadInitialData(mockTeams, false, null));
      const wrapper = createWrapper({
        access: new Set([]),
      });
      expect(wrapper.find('button[aria-label="Request Access"]')).toHaveLength(1);

      // Should also not link to details because of lack of access
      expect(wrapper.find('Link')).toHaveLength(0);
    });

    it('can leave team when you are a member', function () {
      const mockTeams = [TestStubs.Team({hasAccess: true, isMember: true})];
      act(() => void TeamStore.loadInitialData(mockTeams, false, null));
      const wrapper = createWrapper({
        access: new Set([]),
      });
      expect(wrapper.find('button[aria-label="Leave Team"]')).toHaveLength(1);
    });
  });

  describe('Team Requests', function () {
    const orgId = 'org-slug';
    const {organization, project, routerContext} = initializeOrg({
      organization: {
        openMembership: false,
      },
    });
    const accessRequest = TestStubs.AccessRequest();
    const requester = TestStubs.User({
      id: '9',
      username: 'requester@example.com',
      email: 'requester@example.com',
      name: 'Requester',
    });
    const requestList = [accessRequest, TestStubs.AccessRequest({id: '4', requester})];

    const createWrapper = props =>
      mountWithTheme(
        <OrganizationTeams
          params={{orgId: organization.slug, projectId: project.slug}}
          routes={[]}
          features={new Set([])}
          access={new Set([])}
          allTeams={[]}
          activeTeams={[]}
          organization={organization}
          requestList={requestList}
          {...props}
        />,
        routerContext
      );

    it('renders empty', function () {
      const wrapper = createWrapper({
        requestList: [],
      });

      expect(wrapper.find('OrganizationAccessRequests').exists()).toBe(true);
    });
    it('renders team request panel', function () {
      const wrapper = createWrapper({});

      expect(wrapper.find('PanelHeader').first().text()).toBe('Pending Team Requests');
      expect(
        wrapper
          .find('StyledPanelItem')
          .first()
          .text()
          .includes(
            `${accessRequest.member.user.name} requests access to the #${accessRequest.team.slug} team`
          )
      ).toBe(true);
      expect(
        wrapper
          .find('StyledPanelItem')
          .last()
          .text()
          .includes(
            `${requester.name} requests to add ${accessRequest.member.user.name} to the #${accessRequest.team.slug} team`
          )
      ).toBe(true);
    });

    it('can approve', async function () {
      const onUpdateRequestListMock = jest.fn();
      const approveMock = MockApiClient.addMockResponse({
        url: `/organizations/${orgId}/access-requests/${accessRequest.id}/`,
        method: 'PUT',
      });

      const wrapper = createWrapper({
        onRemoveAccessRequest: onUpdateRequestListMock,
      });
      wrapper.find('button[aria-label="Approve"]').first().simulate('click');

      await tick();

      expect(approveMock).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: {
            isApproved: true,
          },
        })
      );
      expect(onUpdateRequestListMock).toHaveBeenCalledWith(accessRequest.id, true);
    });

    it('can deny', async function () {
      const onUpdateRequestListMock = jest.fn();
      const denyMock = MockApiClient.addMockResponse({
        url: `/organizations/${orgId}/access-requests/${accessRequest.id}/`,
        method: 'PUT',
      });

      const wrapper = createWrapper({
        onRemoveAccessRequest: onUpdateRequestListMock,
      });

      wrapper.find('button[aria-label="Deny"]').first().simulate('click');

      await tick();

      expect(denyMock).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: {
            isApproved: false,
          },
        })
      );
      expect(onUpdateRequestListMock).toHaveBeenCalledWith(accessRequest.id, false);
    });
  });
});
