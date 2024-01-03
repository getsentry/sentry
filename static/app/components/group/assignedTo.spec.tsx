import {Commit} from 'sentry-fixture/commit';
import {CommitAuthor} from 'sentry-fixture/commitAuthor';
import {Event as EventFixture} from 'sentry-fixture/event';
import {Group as GroupFixture} from 'sentry-fixture/group';
import {Organization} from 'sentry-fixture/organization';
import {Project as ProjectFixture} from 'sentry-fixture/project';
import {Team} from 'sentry-fixture/team';
import {User} from 'sentry-fixture/user';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import AssignedTo from 'sentry/components/group/assignedTo';
import GroupStore from 'sentry/stores/groupStore';
import MemberListStore from 'sentry/stores/memberListStore';
import ProjectsStore from 'sentry/stores/projectsStore';
import TeamStore from 'sentry/stores/teamStore';
import type {
  Event,
  Group,
  Organization as TOrganization,
  Project,
  Team as TeamType,
  User as UserType,
} from 'sentry/types';

describe('Group > AssignedTo', () => {
  let USER_1!: UserType;
  let USER_2!: UserType;
  let TEAM_1!: TeamType;
  let PROJECT_1!: Project;
  let GROUP_1!: Group;
  let event!: Event;
  let organization!: TOrganization;
  const project = ProjectFixture();

  beforeEach(() => {
    organization = Organization();
    USER_1 = User({
      id: '1',
      name: 'Jane Bloggs',
      email: 'janebloggs@example.com',
    });
    USER_2 = User({
      id: '2',
      name: 'John Smith',
      email: 'johnsmith@example.com',
    });

    TEAM_1 = Team({
      id: '3',
      name: 'COOL TEAM',
      slug: 'cool-team',
    });

    PROJECT_1 = ProjectFixture({
      teams: [TEAM_1],
    });

    GROUP_1 = GroupFixture({
      id: '1337',
      project: ProjectFixture({
        id: PROJECT_1.id,
        slug: PROJECT_1.slug,
      }),
    });
    event = EventFixture();

    TeamStore.loadInitialData([TEAM_1]);
    ProjectsStore.loadInitialData([PROJECT_1]);
    GroupStore.loadInitialData([GROUP_1]);

    jest.spyOn(GroupStore, 'get').mockImplementation(() => GROUP_1);

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/users/',
      body: [{user: USER_1}, {user: USER_2}],
    });
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/events/${event.id}/committers/`,
      body: {},
    });
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/events/${event.id}/owners/`,
      body: {owners: [], rules: []},
    });
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
    GroupStore.reset();
    TeamStore.reset();
    MemberListStore.reset();
  });

  const openMenu = async () => {
    await userEvent.click(await screen.findByTestId('assignee-selector'), {
      // Skip hover to prevent tooltip from rendering
      skipHover: true,
    });
  };

  it('renders unassigned', async () => {
    render(<AssignedTo project={project} group={GROUP_1} />, {organization});
    expect(await screen.findByText('No one')).toBeInTheDocument();
  });

  it('does not render chevron when disableDropdown prop is passed', async () => {
    render(
      <AssignedTo disableDropdown project={project} group={GROUP_1} event={event} />,
      {
        organization,
      }
    );
    expect(await screen.findByText('No one')).toBeInTheDocument();
    expect(screen.queryByTestId('assigned-to-chevron-icon')).not.toBeInTheDocument();
  });

  it('can assign team', async () => {
    const onAssign = jest.fn();
    const assignedGroup: Group = {
      ...GROUP_1,
      assignedTo: {...TEAM_1, type: 'team'},
    };
    const assignMock = MockApiClient.addMockResponse({
      method: 'PUT',
      url: `/organizations/org-slug/issues/${GROUP_1.id}/`,
      body: assignedGroup,
    });
    const {rerender} = render(
      <AssignedTo project={project} group={GROUP_1} event={event} onAssign={onAssign} />,
      {
        organization,
      }
    );
    await openMenu();
    expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();

    const team1slug = `#${TEAM_1.slug}`;
    await userEvent.click(screen.getByText(team1slug));

    await waitFor(() =>
      expect(assignMock).toHaveBeenCalledWith(
        '/organizations/org-slug/issues/1337/',
        expect.objectContaining({
          data: {assignedTo: 'team:3', assignedBy: 'assignee_selector'},
        })
      )
    );
    expect(onAssign).toHaveBeenCalledWith('team', TEAM_1, undefined);

    // Group changes are passed down from parent component
    rerender(<AssignedTo project={project} group={assignedGroup} event={event} />);
    expect(await screen.findByText(team1slug)).toBeInTheDocument();
    // TEAM_1 initials
    expect(screen.getByTestId('assignee-selector')).toHaveTextContent('CT');
  });

  it('successfully clears assignment', async () => {
    const assignedGroup: Group = {
      ...GROUP_1,
      assignedTo: {...TEAM_1, type: 'team'},
    };
    const assignMock = MockApiClient.addMockResponse({
      method: 'PUT',
      url: `/organizations/org-slug/issues/${GROUP_1.id}/`,
      body: assignedGroup,
    });

    const {rerender} = render(
      <AssignedTo project={project} group={GROUP_1} event={event} />,
      {
        organization,
      }
    );
    await openMenu();

    // Assign first item in list, which is TEAM_1
    await userEvent.click(screen.getByText(`#${TEAM_1.slug}`));

    await waitFor(() =>
      expect(assignMock).toHaveBeenCalledWith(
        '/organizations/org-slug/issues/1337/',
        expect.objectContaining({
          data: {assignedTo: 'team:3', assignedBy: 'assignee_selector'},
        })
      )
    );

    // Group changes are passed down from parent component
    rerender(<AssignedTo project={project} group={assignedGroup} event={event} />);
    await openMenu();
    await userEvent.click(screen.getByRole('button', {name: 'Clear Assignee'}));

    // api was called with empty string, clearing assignment
    await waitFor(() =>
      expect(assignMock).toHaveBeenLastCalledWith(
        '/organizations/org-slug/issues/1337/',
        expect.objectContaining({
          data: {assignedTo: '', assignedBy: 'assignee_selector'},
        })
      )
    );
  });

  it('displays suggested assignees from committers and owners', async () => {
    const onAssign = jest.fn();
    const author = CommitAuthor({id: USER_2.id});
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/events/${event.id}/committers/`,
      body: {
        committers: [
          {
            commits: [Commit({author})],
            author,
          },
        ],
      },
    });
    MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/events/1/owners/',
      body: {
        owners: [{type: 'team', ...TEAM_1}],
        rules: [[['codeowners', '/./app/components'], [['team', TEAM_1.name]]]],
      },
    });
    const assignedGroup: Group = {
      ...GROUP_1,
      assignedTo: {...USER_2, type: 'user'},
    };
    const assignMock = MockApiClient.addMockResponse({
      method: 'PUT',
      url: `/organizations/org-slug/issues/${GROUP_1.id}/`,
      body: assignedGroup,
    });

    render(
      <AssignedTo project={project} group={GROUP_1} event={event} onAssign={onAssign} />,
      {
        organization,
      }
    );
    await openMenu();

    expect(screen.getByText('Suspect commit author')).toBeInTheDocument();
    expect(screen.getByText('Owner of codeowners:/./app/components')).toBeInTheDocument();

    await userEvent.click(screen.getByText('Suspect commit author'));

    await waitFor(() =>
      expect(assignMock).toHaveBeenLastCalledWith(
        '/organizations/org-slug/issues/1337/',
        expect.objectContaining({
          data: {assignedTo: 'user:2', assignedBy: 'assignee_selector'},
        })
      )
    );
    expect(onAssign).toHaveBeenCalledWith(
      'member',
      USER_2,
      expect.objectContaining({
        suggestedReason: 'suspectCommit',
        suggestedReasonText: 'Suspect commit author',
      })
    );
  });
});
