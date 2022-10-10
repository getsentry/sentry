import {act, render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import AssignedTo from 'sentry/components/group/assignedTo';
import GroupStore from 'sentry/stores/groupStore';
import MemberListStore from 'sentry/stores/memberListStore';
import ProjectsStore from 'sentry/stores/projectsStore';
import TeamStore from 'sentry/stores/teamStore';

describe('Group > AssignedTo', () => {
  let USER_1, USER_2;
  let TEAM_1;
  let PROJECT_1;
  let GROUP_1;
  let organization;
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
    TeamStore.loadInitialData([TEAM_1]);
    ProjectsStore.loadInitialData([PROJECT_1]);
    GroupStore.loadInitialData([GROUP_1]);

    jest.spyOn(GroupStore, 'get').mockImplementation(() => GROUP_1);

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/users/',
      body: [],
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
    render(<AssignedTo projectId={project.id} group={GROUP_1} />, {organization});
    expect(screen.getByText('No-one')).toBeInTheDocument();
  });

  it('can assign team', async () => {
    const assignMock = MockApiClient.addMockResponse({
      method: 'PUT',
      url: `/issues/${GROUP_1.id}/`,
      body: {
        ...GROUP_1,
        assignedTo: {...TEAM_1, type: 'team'},
      },
    });
    render(<AssignedTo projectId={project.id} group={GROUP_1} />, {organization});
    act(() => MemberListStore.loadInitialData([USER_1, USER_2]));
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

    expect(await screen.findByText(team1slug)).toBeInTheDocument();
    // TEAM_1 initials
    expect(screen.getByTestId('assignee-selector')).toHaveTextContent('CT');
  });

  it('successfully clears assignment', async () => {
    const assignMock = MockApiClient.addMockResponse({
      method: 'PUT',
      url: `/issues/${GROUP_1.id}/`,
      body: {
        ...GROUP_1,
        assignedTo: {...TEAM_1, type: 'team'},
      },
    });

    render(<AssignedTo projectId={project.id} group={GROUP_1} />, {organization});
    act(() => MemberListStore.loadInitialData([USER_1, USER_2]));
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
});
