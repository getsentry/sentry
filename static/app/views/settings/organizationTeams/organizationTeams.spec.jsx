import {AccessRequest} from 'fixtures/js-stubs/accessRequest';
import {Organization} from 'fixtures/js-stubs/organization';
import {Team} from 'fixtures/js-stubs/team';
import {User} from 'fixtures/js-stubs/user';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {act, render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {openCreateTeamModal} from 'sentry/actionCreators/modal';
import TeamStore from 'sentry/stores/teamStore';
import recreateRoute from 'sentry/utils/recreateRoute';
import OrganizationTeams from 'sentry/views/settings/organizationTeams/organizationTeams';

recreateRoute.mockReturnValue('');

jest.mock('sentry/actionCreators/modal', () => ({
  openCreateTeamModal: jest.fn(),
}));

describe('OrganizationTeams', function () {
  describe('Open Membership', function () {
    const {organization, project} = initializeOrg({
      organization: {
        openMembership: true,
      },
    });

    const createWrapper = props =>
      render(
        <OrganizationTeams
          params={{orgId: organization.slug, projectId: project.slug}}
          routes={[]}
          features={new Set(['open-membership'])}
          access={new Set(['project:admin'])}
          organization={organization}
          {...props}
        />
      );

    it('opens "create team modal" when creating a new team from header', function () {
      createWrapper();

      // Click "Create Team" in Panel Header
      userEvent.click(screen.getByLabelText('Create Team'));

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
      const mockTeams = [Team({hasAccess: true, isMember: false})];
      act(() => void TeamStore.loadInitialData(mockTeams, false, null));
      createWrapper({
        access: new Set([]),
      });
      expect(screen.getByLabelText('Join Team')).toBeInTheDocument();

      // Should also link to details
      expect(screen.getByTestId('team-link')).toBeInTheDocument();
    });

    it('reloads projects after joining a team', async function () {
      const team = Team({hasAccess: true, isMember: false});
      const getOrgMock = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/',
        body: Organization(),
      });
      MockApiClient.addMockResponse({
        url: `/organizations/org-slug/members/me/teams/${team.slug}/`,
        method: 'POST',
        body: {...team, isMember: true},
      });

      const mockTeams = [team];
      act(() => void TeamStore.loadInitialData(mockTeams, false, null));

      createWrapper({access: new Set([])});
      act(() => void userEvent.click(screen.getByLabelText('Join Team')));
      await act(() => tick());

      expect(getOrgMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('Closed Membership', function () {
    const {organization, project} = initializeOrg({
      organization: {
        openMembership: false,
      },
    });
    const createWrapper = props =>
      render(
        <OrganizationTeams
          params={{orgId: organization.slug, projectId: project.slug}}
          routes={[]}
          features={new Set([])}
          access={new Set([])}
          allTeams={[]}
          activeTeams={[]}
          organization={organization}
          {...props}
        />
      );

    it('can request access to team and does not have link to details', function () {
      const mockTeams = [Team({hasAccess: false, isMember: false})];
      act(() => void TeamStore.loadInitialData(mockTeams, false, null));
      createWrapper({access: new Set([])});

      expect(screen.getByLabelText('Request Access')).toBeInTheDocument();

      // Should also not link to details because of lack of access
      expect(screen.queryByTestId('team-link')).not.toBeInTheDocument();
    });

    it('can leave team when you are a member', function () {
      const mockTeams = [Team({hasAccess: true, isMember: true})];
      act(() => void TeamStore.loadInitialData(mockTeams, false, null));
      createWrapper({
        access: new Set([]),
      });

      expect(screen.getByLabelText('Leave Team')).toBeInTheDocument();
    });
  });

  describe('Team Requests', function () {
    const orgId = 'org-slug';
    const {organization, project} = initializeOrg({
      organization: {
        openMembership: false,
      },
    });
    const accessRequest = AccessRequest();
    const requester = User({
      id: '9',
      username: 'requester@example.com',
      email: 'requester@example.com',
      name: 'Requester',
    });
    const requestList = [accessRequest, AccessRequest({id: '4', requester})];

    const createWrapper = props =>
      render(
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
        />
      );

    it('renders team request panel', function () {
      createWrapper();

      expect(screen.getByText('Pending Team Requests')).toBeInTheDocument();
      expect(screen.queryAllByTestId('request-message')).toHaveLength(2);
      expect(screen.queryAllByTestId('request-message')[0]).toHaveTextContent(
        `${accessRequest.member.user.name} requests access to the #${accessRequest.team.slug} team`
      );
    });

    it('can approve', async function () {
      const onUpdateRequestListMock = jest.fn();
      const approveMock = MockApiClient.addMockResponse({
        url: `/organizations/${orgId}/access-requests/${accessRequest.id}/`,
        method: 'PUT',
      });

      createWrapper({
        onRemoveAccessRequest: onUpdateRequestListMock,
      });
      userEvent.click(screen.getAllByLabelText('Approve')[0]);

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

      createWrapper({
        onRemoveAccessRequest: onUpdateRequestListMock,
      });

      userEvent.click(screen.getAllByLabelText('Deny')[0]);

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

  describe('Team Roles', function () {
    const features = new Set(['team-roles']);
    const access = new Set();

    it('does not render alert without feature flag', function () {
      const {organization, project} = initializeOrg({organization: {orgRole: 'admin'}});
      render(
        <OrganizationTeams
          params={{orgId: organization.slug, projectId: project.slug}}
          routes={[]}
          features={new Set()}
          access={access}
          organization={organization}
        />
      );

      expect(screen.queryByText('a minimum team-level role of')).not.toBeInTheDocument();
    });

    it('renders alert with elevated org role', function () {
      const {organization, project} = initializeOrg({organization: {orgRole: 'admin'}});
      render(
        <OrganizationTeams
          params={{orgId: organization.slug, projectId: project.slug}}
          routes={[]}
          features={features}
          access={access}
          organization={organization}
        />
      );

      expect(screen.getByText('a minimum team-level role of')).toBeInTheDocument();
    });

    it('does not render alert with lowest org role', function () {
      const {organization, project} = initializeOrg({organization: {orgRole: 'member'}});
      render(
        <OrganizationTeams
          params={{orgId: organization.slug, projectId: project.slug}}
          routes={[]}
          features={features}
          access={access}
          organization={organization}
        />
      );

      expect(screen.queryByText('a minimum team-level role of')).not.toBeInTheDocument();
    });
  });
});
