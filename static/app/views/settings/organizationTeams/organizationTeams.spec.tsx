import {AccessRequest} from 'sentry-fixture/accessRequest';
import {Organization} from 'sentry-fixture/organization';
import {Team} from 'sentry-fixture/team';
import {User} from 'sentry-fixture/user';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {act, render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {openCreateTeamModal} from 'sentry/actionCreators/modal';
import TeamStore from 'sentry/stores/teamStore';
import recreateRoute from 'sentry/utils/recreateRoute';
import OrganizationTeams from 'sentry/views/settings/organizationTeams/organizationTeams';

jest.mocked(recreateRoute).mockReturnValue('');

jest.mock('sentry/actionCreators/modal', () => ({
  openCreateTeamModal: jest.fn(),
}));

describe('OrganizationTeams', function () {
  describe('Open Membership', function () {
    const {organization, project, routerProps} = initializeOrg({
      organization: {
        openMembership: true,
      },
    });

    const createWrapper = (
      props?: Partial<React.ComponentProps<typeof OrganizationTeams>>
    ) =>
      render(
        <OrganizationTeams
          {...routerProps}
          onRemoveAccessRequest={() => {}}
          requestList={[]}
          params={{projectId: project.slug}}
          features={new Set(['open-membership'])}
          access={new Set(['project:admin'])}
          organization={organization}
          {...props}
        />
      );

    it('opens "create team modal" when creating a new team from header', async function () {
      createWrapper();

      // Click "Create Team" in Panel Header
      await userEvent.click(screen.getByLabelText('Create Team'));

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
      const mockTeams = [
        Team({
          hasAccess: true,
          isMember: false,
        }),
      ];
      act(() => void TeamStore.loadInitialData(mockTeams, false, null));
      createWrapper({
        access: new Set([]),
      });
      expect(screen.getByLabelText('Join Team')).toBeInTheDocument();

      // Should also link to details
      expect(screen.getByTestId('team-link')).toBeInTheDocument();
    });

    it('reloads projects after joining a team', async function () {
      const team = Team({
        hasAccess: true,
        isMember: false,
      });
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
      await userEvent.click(screen.getByLabelText('Join Team'));

      await waitFor(() => {
        expect(getOrgMock).toHaveBeenCalledTimes(1);
      });
    });

    it('cannot leave idp-provisioned team', function () {
      const mockTeams = [Team({flags: {'idp:provisioned': true}, isMember: true})];
      act(() => void TeamStore.loadInitialData(mockTeams, false, null));
      createWrapper();

      expect(screen.getByRole('button', {name: 'Leave Team'})).toBeDisabled();
    });

    it('cannot join idp-provisioned team', function () {
      const mockTeams = [Team({flags: {'idp:provisioned': true}, isMember: false})];
      act(() => void TeamStore.loadInitialData(mockTeams, false, null));
      createWrapper({
        access: new Set([]),
      });

      expect(screen.getByRole('button', {name: 'Join Team'})).toBeDisabled();
    });
  });

  describe('Closed Membership', function () {
    const {organization, project, routerProps} = initializeOrg({
      organization: {
        openMembership: false,
      },
    });
    const createWrapper = (
      props?: Partial<React.ComponentProps<typeof OrganizationTeams>>
    ) =>
      render(
        <OrganizationTeams
          {...routerProps}
          onRemoveAccessRequest={() => {}}
          requestList={[]}
          params={{projectId: project.slug}}
          features={new Set([])}
          access={new Set([])}
          organization={organization}
          {...props}
        />
      );

    it('can request access to team and does not have link to details', function () {
      const mockTeams = [
        Team({
          hasAccess: false,
          isMember: false,
        }),
      ];
      act(() => void TeamStore.loadInitialData(mockTeams, false, null));
      createWrapper({access: new Set([])});

      expect(screen.getByLabelText('Request Access')).toBeInTheDocument();

      // Should also not link to details because of lack of access
      expect(screen.queryByTestId('team-link')).not.toBeInTheDocument();
    });

    it('can leave team when you are a member', function () {
      const mockTeams = [
        Team({
          hasAccess: true,
          isMember: true,
        }),
      ];
      act(() => void TeamStore.loadInitialData(mockTeams, false, null));
      createWrapper({
        access: new Set([]),
      });

      expect(screen.getByLabelText('Leave Team')).toBeInTheDocument();
    });

    it('cannot request to join idp-provisioned team', function () {
      const mockTeams = [Team({flags: {'idp:provisioned': true}, isMember: false})];
      act(() => void TeamStore.loadInitialData(mockTeams, false, null));
      createWrapper({
        access: new Set([]),
      });

      expect(screen.getByRole('button', {name: 'Request Access'})).toBeDisabled();
    });

    it('cannot leave idp-provisioned team', function () {
      const mockTeams = [Team({flags: {'idp:provisioned': true}, isMember: true})];
      act(() => void TeamStore.loadInitialData(mockTeams, false, null));
      createWrapper({
        access: new Set([]),
      });

      expect(screen.getByRole('button', {name: 'Leave Team'})).toBeDisabled();
    });
  });

  describe('Team Requests', function () {
    const {organization, project, routerProps} = initializeOrg({
      organization: {
        openMembership: false,
      },
    });
    const orgId = organization.slug;
    const accessRequest = AccessRequest({
      requester: {},
    });
    const requester = User({
      id: '9',
      username: 'requester@example.com',
      email: 'requester@example.com',
      name: 'Requester',
    });
    const requestList = [accessRequest, AccessRequest({id: '4', requester})];

    const createWrapper = (
      props?: Partial<React.ComponentProps<typeof OrganizationTeams>>
    ) =>
      render(
        <OrganizationTeams
          {...routerProps}
          onRemoveAccessRequest={() => {}}
          params={{projectId: project.slug}}
          features={new Set([])}
          access={new Set([])}
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
        `${accessRequest.member.user?.name} requests access to the #${accessRequest.team.slug} team`
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
      await userEvent.click(screen.getAllByLabelText('Approve')[0]);

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

      await userEvent.click(screen.getAllByLabelText('Deny')[0]);

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
    const access = new Set<string>();

    it('does not render alert without feature flag', function () {
      const {organization, project, routerProps} = initializeOrg({
        organization: {orgRole: 'admin'},
      });
      render(
        <OrganizationTeams
          {...routerProps}
          requestList={[]}
          onRemoveAccessRequest={() => {}}
          params={{projectId: project.slug}}
          features={new Set()}
          access={access}
          organization={organization}
        />
      );

      expect(screen.queryByText('a minimum team-level role of')).not.toBeInTheDocument();
    });

    it('renders alert with elevated org role', function () {
      const {organization, project, routerProps} = initializeOrg({
        organization: {orgRole: 'admin'},
      });
      render(
        <OrganizationTeams
          {...routerProps}
          requestList={[]}
          onRemoveAccessRequest={() => {}}
          params={{projectId: project.slug}}
          features={features}
          access={access}
          organization={organization}
        />
      );

      expect(
        // Text broken up by styles
        screen.getByText(
          'Your organization role as an has granted you a minimum team-level role of'
        )
      ).toBeInTheDocument();
    });

    it('does not render alert with lowest org role', function () {
      const {organization, project, routerProps} = initializeOrg({
        organization: {orgRole: 'member'},
      });
      render(
        <OrganizationTeams
          {...routerProps}
          requestList={[]}
          onRemoveAccessRequest={() => {}}
          params={{projectId: project.slug}}
          features={features}
          access={access}
          organization={organization}
        />
      );

      expect(screen.queryByText('a minimum team-level role of')).not.toBeInTheDocument();
    });
  });
});
