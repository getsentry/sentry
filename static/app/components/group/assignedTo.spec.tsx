import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import AssignedTo from 'sentry/components/group/assignedTo';
import GroupStore from 'sentry/stores/groupStore';
import MemberListStore from 'sentry/stores/memberListStore';
import ProjectsStore from 'sentry/stores/projectsStore';
import TeamStore from 'sentry/stores/teamStore';
import type {Event, Group, Organization, Project, Team, User} from 'sentry/types';

describe('Group > AssignedTo', () => {
  let USER_1!: User;
  let USER_2!: User;
  let TEAM_1!: Team;
  let PROJECT_1!: Project;
  let GROUP_1!: Group;
  let event!: Event;
  let organization!: Organization;
  const project = TestStubs.Project();

  beforeEach(() => {
    organization = TestStubs.Organization();
    USER_1 = TestStubs.User({
      id: '1',
      name: 'Jane Bloggs',
      email: 'janebloggs@example.com',
    });
    USER_2 = TestStubs.User({
      id: '2',
      name: 'John Smith',
      email: 'johnsmith@example.com',
    });

    TEAM_1 = TestStubs.Team({
      id: '3',
      name: 'COOL TEAM',
      slug: 'cool-team',
    });

    PROJECT_1 = TestStubs.Project({
      teams: [TEAM_1],
    });

    GROUP_1 = TestStubs.Group({
      id: '1337',
      project: {
        id: PROJECT_1.id,
        slug: PROJECT_1.slug,
      },
    });
    event = TestStubs.Event();

    TeamStore.loadInitialData([TEAM_1]);
    ProjectsStore.loadInitialData([PROJECT_1]);
    GroupStore.loadInitialData([GROUP_1]);

    jest.spyOn(GroupStore, 'get').mockImplementation(() => GROUP_1);

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/users/',
      body: [{user: USER_1}, {user: USER_2}],
    });
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
    GroupStore.reset();
    TeamStore.reset();
    MemberListStore.state = [];
    MemberListStore.loaded = false;
  });

  const openMenu = async () => {
    userEvent.click(await screen.findByTestId('assignee-selector'), undefined, {
      // Skip hover to prevent tooltip from rendering
      skipHover: true,
    });
  };

  it('renders unassigned', () => {
    render(<AssignedTo project={project} group={GROUP_1} />, {organization});
    expect(screen.getByText('No one')).toBeInTheDocument();
  });

  it('does not render chevron when disableDropdown prop is passed', () => {
    render(
      <AssignedTo disableDropdown project={project} group={GROUP_1} event={event} />,
      {
        organization,
      }
    );
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
      url: `/issues/${GROUP_1.id}/`,
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
    userEvent.click(screen.getByText(team1slug));

    await waitFor(() =>
      expect(assignMock).toHaveBeenCalledWith(
        '/issues/1337/',
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
      url: `/issues/${GROUP_1.id}/`,
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
    userEvent.click(screen.getByText(`#${TEAM_1.slug}`));

    await waitFor(() =>
      expect(assignMock).toHaveBeenCalledWith(
        '/issues/1337/',
        expect.objectContaining({
          data: {assignedTo: 'team:3', assignedBy: 'assignee_selector'},
        })
      )
    );

    // Group changes are passed down from parent component
    rerender(<AssignedTo project={project} group={assignedGroup} event={event} />);
    await openMenu();
    userEvent.click(screen.getByRole('button', {name: 'Clear Assignee'}));

    // api was called with empty string, clearing assignment
    await waitFor(() =>
      expect(assignMock).toHaveBeenLastCalledWith(
        '/issues/1337/',
        expect.objectContaining({
          data: {assignedTo: '', assignedBy: 'assignee_selector'},
        })
      )
    );
  });

  it('displays suggested assignees from committers and owners', async () => {
    const onAssign = jest.fn();
    const author = TestStubs.CommitAuthor({id: USER_2.id});
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/events/${event.id}/committers/`,
      body: {
        committers: [
          {
            commits: [TestStubs.Commit({author})],
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
      url: `/issues/${GROUP_1.id}/`,
      body: assignedGroup,
    });

    render(
      <AssignedTo project={project} group={GROUP_1} event={event} onAssign={onAssign} />,
      {
        organization: {...organization, features: ['streamline-targeting-context']},
      }
    );
    await openMenu();

    expect(screen.getByText('Suspect commit author')).toBeInTheDocument();
    expect(screen.getByText('Owner of codeowners:/./app/components')).toBeInTheDocument();

    userEvent.click(screen.getByText('Suspect commit author'));

    await waitFor(() =>
      expect(assignMock).toHaveBeenLastCalledWith(
        '/issues/1337/',
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
