import {AccessRequestFixture} from 'sentry-fixture/accessRequest';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {TeamFixture} from 'sentry-fixture/team';
import {UserFixture} from 'sentry-fixture/user';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {openCreateTeamModal} from 'sentry/actionCreators/modal';
import ProjectsStore from 'sentry/stores/projectsStore';
import TeamStore from 'sentry/stores/teamStore';
import recreateRoute from 'sentry/utils/recreateRoute';
import OrganizationTeams from 'sentry/views/settings/organizationTeams/organizationTeams';

jest.mocked(recreateRoute).mockReturnValue('');

jest.mock('sentry/actionCreators/modal', () => ({
  openCreateTeamModal: jest.fn(),
}));

describe('OrganizationTeams', () => {
  describe('Open Membership', () => {
    const {organization} = initializeOrg({
      organization: {
        openMembership: true,
      },
    });

    const createWrapper = (
      props?: Partial<React.ComponentProps<typeof OrganizationTeams>>
    ) =>
      render(
        <OrganizationTeams
          organization={organization}
          access={new Set(['project:admin'])}
          features={new Set(['open-membership'])}
          requestList={[]}
          onRemoveAccessRequest={() => {}}
          {...props}
        />
      );

    it('opens "create team modal" when creating a new team from header', async () => {
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

    it('can join team and have link to details', () => {
      const team = TeamFixture({
        hasAccess: true,
        isMember: false,
      });
      const mockTeams = [team];
      TeamStore.loadInitialData(mockTeams, false, null);
      ProjectsStore.loadInitialData([
        ProjectFixture({slug: 'project-1', teams: [team]}),
        ProjectFixture({slug: 'project-2', teams: [team]}),
      ]);
      createWrapper({
        access: new Set([]),
      });
      expect(screen.getByLabelText('Join Team')).toBeInTheDocument();

      // Should also link to details
      expect(screen.getByTestId('team-link')).toBeInTheDocument();

      // Shows project count
      expect(screen.getByText('2 projects')).toBeInTheDocument();
    });

    it('reloads projects after joining a team', async () => {
      const team = TeamFixture({
        hasAccess: true,
        isMember: false,
      });
      const getOrgMock = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/',
        body: OrganizationFixture(),
      });
      MockApiClient.addMockResponse({
        url: `/organizations/org-slug/members/me/teams/${team.slug}/`,
        method: 'POST',
        body: {...team, isMember: true},
      });

      const mockTeams = [team];
      TeamStore.loadInitialData(mockTeams, false, null);

      createWrapper({access: new Set([])});
      await userEvent.click(screen.getByLabelText('Join Team'));

      await waitFor(() => {
        expect(getOrgMock).toHaveBeenCalledTimes(1);
      });
    });

    it('cannot leave idp-provisioned team', () => {
      const mockTeams = [TeamFixture({flags: {'idp:provisioned': true}, isMember: true})];
      TeamStore.loadInitialData(mockTeams, false, null);
      createWrapper();

      expect(screen.getByRole('button', {name: 'Leave Team'})).toBeDisabled();
    });

    it('cannot join idp-provisioned team', () => {
      const mockTeams = [
        TeamFixture({flags: {'idp:provisioned': true}, isMember: false}),
      ];
      TeamStore.loadInitialData(mockTeams, false, null);
      createWrapper({
        access: new Set([]),
      });

      expect(screen.getByRole('button', {name: 'Join Team'})).toBeDisabled();
    });
  });

  describe('Closed Membership', () => {
    const {organization} = initializeOrg({
      organization: {
        openMembership: false,
      },
    });
    const createWrapper = (
      props?: Partial<React.ComponentProps<typeof OrganizationTeams>>
    ) =>
      render(
        <OrganizationTeams
          organization={organization}
          access={new Set([])}
          features={new Set([])}
          requestList={[]}
          onRemoveAccessRequest={() => {}}
          {...props}
        />
      );

    it('can request access to team and does not have link to details', () => {
      const mockTeams = [
        TeamFixture({
          hasAccess: false,
          isMember: false,
        }),
      ];
      TeamStore.loadInitialData(mockTeams, false, null);
      createWrapper({access: new Set([])});

      expect(screen.getByLabelText('Request Access')).toBeInTheDocument();

      // Should also not link to details because of lack of access
      expect(screen.queryByTestId('team-link')).not.toBeInTheDocument();
    });

    it('can leave team when you are a member', () => {
      const mockTeams = [
        TeamFixture({
          hasAccess: true,
          isMember: true,
        }),
      ];
      TeamStore.loadInitialData(mockTeams, false, null);
      createWrapper({
        access: new Set([]),
      });

      expect(screen.getByLabelText('Leave Team')).toBeInTheDocument();
    });

    it('cannot request to join idp-provisioned team', () => {
      const mockTeams = [
        TeamFixture({flags: {'idp:provisioned': true}, isMember: false}),
      ];
      TeamStore.loadInitialData(mockTeams, false, null);
      createWrapper({
        access: new Set([]),
      });

      expect(screen.getByRole('button', {name: 'Request Access'})).toBeDisabled();
    });

    it('cannot leave idp-provisioned team', () => {
      const mockTeams = [TeamFixture({flags: {'idp:provisioned': true}, isMember: true})];
      TeamStore.loadInitialData(mockTeams, false, null);
      createWrapper({
        access: new Set([]),
      });

      expect(screen.getByRole('button', {name: 'Leave Team'})).toBeDisabled();
    });
  });

  describe('Team Requests', () => {
    const {organization} = initializeOrg({
      organization: {
        openMembership: false,
      },
    });
    const orgId = organization.slug;
    const accessRequest = AccessRequestFixture({
      requester: {},
    });
    const requester = UserFixture({
      id: '9',
      username: 'requester@example.com',
      email: 'requester@example.com',
      name: 'Requester',
    });
    const requestList = [accessRequest, AccessRequestFixture({id: '4', requester})];

    const createWrapper = (
      props?: Partial<React.ComponentProps<typeof OrganizationTeams>>
    ) =>
      render(
        <OrganizationTeams
          organization={organization}
          access={new Set([])}
          features={new Set([])}
          requestList={requestList}
          onRemoveAccessRequest={() => {}}
          {...props}
        />
      );

    it('renders team request panel', () => {
      createWrapper();

      expect(screen.getByText('Pending Team Requests')).toBeInTheDocument();
      expect(screen.queryAllByTestId('request-message')).toHaveLength(2);
      expect(screen.queryAllByTestId('request-message')[0]).toHaveTextContent(
        `${accessRequest.member.user?.name} requests access to the #${accessRequest.team.slug} team`
      );
    });

    it('can approve', async () => {
      const onUpdateRequestListMock = jest.fn();
      const approveMock = MockApiClient.addMockResponse({
        url: `/organizations/${orgId}/access-requests/${accessRequest.id}/`,
        method: 'PUT',
      });

      createWrapper({
        onRemoveAccessRequest: onUpdateRequestListMock,
      });
      await userEvent.click(screen.getAllByLabelText('Approve')[0]!);

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

    it('can deny', async () => {
      const onUpdateRequestListMock = jest.fn();
      const denyMock = MockApiClient.addMockResponse({
        url: `/organizations/${orgId}/access-requests/${accessRequest.id}/`,
        method: 'PUT',
      });

      createWrapper({
        onRemoveAccessRequest: onUpdateRequestListMock,
      });

      await userEvent.click(screen.getAllByLabelText('Deny')[0]!);

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

  describe('Empty States', () => {
    beforeEach(() => {
      TeamStore.reset();
    });

    it('shows empty state when no teams exist', async () => {
      const {organization} = initializeOrg();
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/teams/`,
        body: [],
      });
      TeamStore.loadInitialData([], false, null);

      render(
        <OrganizationTeams
          organization={organization}
          access={new Set(['project:admin'])}
          features={new Set([])}
          requestList={[]}
          onRemoveAccessRequest={() => {}}
        />
      );

      expect(
        await screen.findByText(/No teams have been created yet/)
      ).toBeInTheDocument();
    });

    it('shows empty state when user has not joined any teams', async () => {
      const {organization} = initializeOrg();
      const team = TeamFixture({isMember: false});
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/teams/`,
        body: [team],
      });
      TeamStore.loadInitialData([team], false, null);

      render(
        <OrganizationTeams
          organization={organization}
          access={new Set(['project:admin'])}
          features={new Set([])}
          requestList={[]}
          onRemoveAccessRequest={() => {}}
        />
      );

      expect(
        await screen.findByText(/You haven't joined any teams yet/)
      ).toBeInTheDocument();
    });

    it('shows empty state when user is member of all teams', async () => {
      const {organization} = initializeOrg();
      const team = TeamFixture({isMember: true});
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/teams/`,
        body: [team],
      });
      TeamStore.loadInitialData([team], false, null);

      render(
        <OrganizationTeams
          organization={organization}
          access={new Set(['project:admin'])}
          features={new Set([])}
          requestList={[]}
          onRemoveAccessRequest={() => {}}
        />
      );

      expect(await screen.findByText(/You're a member of all teams/)).toBeInTheDocument();
    });

    it('does not show create team link without permission', async () => {
      const {organization} = initializeOrg();
      const team = TeamFixture({isMember: true});
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/teams/`,
        body: [team],
      });
      TeamStore.loadInitialData([team], false, null);

      render(
        <OrganizationTeams
          organization={organization}
          access={new Set([])}
          features={new Set([])}
          requestList={[]}
          onRemoveAccessRequest={() => {}}
        />
      );

      expect(await screen.findByText(/You're a member of all teams/)).toBeInTheDocument();
      expect(
        screen.queryByRole('button', {name: 'Create another team'})
      ).not.toBeInTheDocument();
    });
  });

  describe('Team Roles', () => {
    const features = new Set(['team-roles']);
    const access = new Set<string>();

    it('does not render alert without feature flag', () => {
      const {organization} = initializeOrg({
        organization: {orgRole: 'admin'},
      });
      render(
        <OrganizationTeams
          organization={organization}
          access={access}
          features={new Set()}
          requestList={[]}
          onRemoveAccessRequest={() => {}}
        />,
        {organization}
      );

      expect(screen.queryByText('a minimum team-level role of')).not.toBeInTheDocument();
    });

    it('renders alert with elevated org role', () => {
      const {organization} = initializeOrg({
        organization: {orgRole: 'admin'},
      });
      render(
        <OrganizationTeams
          organization={organization}
          access={access}
          features={features}
          requestList={[]}
          onRemoveAccessRequest={() => {}}
        />,
        {organization}
      );

      expect(
        // Text broken up by styles
        screen.getByText(
          'Your organization role as an has granted you a minimum team-level role of'
        )
      ).toBeInTheDocument();
    });

    it('does not render alert with lowest org role', () => {
      const {organization} = initializeOrg({
        organization: {orgRole: 'member'},
      });
      render(
        <OrganizationTeams
          organization={organization}
          access={access}
          features={features}
          requestList={[]}
          onRemoveAccessRequest={() => {}}
        />,
        {organization}
      );

      expect(screen.queryByText('a minimum team-level role of')).not.toBeInTheDocument();
    });
  });
});
