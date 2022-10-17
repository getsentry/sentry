import {act, render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {openInviteMembersModal} from 'sentry/actionCreators/modal';
import {Client} from 'sentry/api';
import AssigneeSelectorComponent from 'sentry/components/assigneeSelector';
import {putSessionUserFirst} from 'sentry/components/assigneeSelectorDropdown';
import ConfigStore from 'sentry/stores/configStore';
import GroupStore from 'sentry/stores/groupStore';
import MemberListStore from 'sentry/stores/memberListStore';
import ProjectsStore from 'sentry/stores/projectsStore';
import TeamStore from 'sentry/stores/teamStore';

jest.mock('sentry/actionCreators/modal', () => ({
  openInviteMembersModal: jest.fn(),
}));

describe('AssigneeSelector', () => {
  let assignMock;
  let assignGroup2Mock;
  let USER_1, USER_2, USER_3;
  let TEAM_1;
  let PROJECT_1;
  let GROUP_1;
  let GROUP_2;

  beforeEach(() => {
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
    USER_3 = TestStubs.User({
      id: '3',
      name: 'J J',
      email: 'jj@example.com',
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

    GROUP_2 = TestStubs.Group({
      id: '1338',
      project: {
        id: PROJECT_1.id,
        slug: PROJECT_1.slug,
      },
      owners: [
        {
          type: 'suspectCommit',
          owner: 'user:1',
          date_added: '',
        },
      ],
    });
    TeamStore.reset();
    TeamStore.setTeams([TEAM_1]);
    GroupStore.reset();

    jest.spyOn(MemberListStore, 'getAll').mockImplementation(() => null);
    jest.spyOn(ProjectsStore, 'getAll').mockImplementation(() => [PROJECT_1]);
    jest.spyOn(GroupStore, 'get').mockImplementation(() => GROUP_1);

    assignMock = Client.addMockResponse({
      method: 'PUT',
      url: `/issues/${GROUP_1.id}/`,
      body: {
        ...GROUP_1,
        assignedTo: {...USER_1, type: 'user'},
      },
    });

    assignGroup2Mock = Client.addMockResponse({
      method: 'PUT',
      url: `/issues/${GROUP_2.id}/`,
      body: {
        ...GROUP_2,
        assignedTo: {...USER_1, type: 'user'},
      },
    });

    MemberListStore.state = [];
    MemberListStore.loaded = false;
  });

  // Doesn't need to always be async, but it was easier to prevent flakes this way
  const openMenu = async () => {
    userEvent.click(await screen.findByTestId('assignee-selector'), undefined, {
      // Skip hover to prevent tooltip from rendering
      skipHover: true,
    });
  };

  afterEach(() => {
    Client.clearMockResponses();
  });

  describe('render with props', () => {
    it('renders members from the prop when present', async () => {
      MemberListStore.loadInitialData([USER_1]);
      render(<AssigneeSelectorComponent id={GROUP_1.id} memberList={[USER_2, USER_3]} />);
      await openMenu();
      expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();

      // 3 total items
      expect(screen.getAllByTestId('assignee-option')).toHaveLength(3);
      // 1 team
      expect(screen.getByText(`#${TEAM_1.slug}`)).toBeInTheDocument();
      // 2 Users
      expect(screen.getByText(USER_2.name)).toBeInTheDocument();
      expect(screen.getByText(USER_3.name)).toBeInTheDocument();
    });
  });

  describe('putSessionUserFirst()', () => {
    it('should place the session user at the top of the member list if present', () => {
      render(<AssigneeSelectorComponent id={GROUP_1.id} />);
      jest.spyOn(ConfigStore, 'get').mockImplementation(() => ({
        id: '2',
        name: 'John Smith',
        email: 'johnsmith@example.com',
      }));
      expect(putSessionUserFirst([USER_1, USER_2])).toEqual([USER_2, USER_1]);
      ConfigStore.get.mockRestore();
    });

    it("should return the same member list if the session user isn't present", () => {
      render(<AssigneeSelectorComponent id={GROUP_1.id} />);
      jest.spyOn(ConfigStore, 'get').mockImplementation(() => ({
        id: '555',
        name: 'Here Comes a New Challenger',
        email: 'guile@mail.us.af.mil',
      }));

      expect(putSessionUserFirst([USER_1, USER_2])).toEqual([USER_1, USER_2]);
      ConfigStore.get.mockRestore();
    });
  });

  it('should initially have loading state', async () => {
    render(<AssigneeSelectorComponent id={GROUP_1.id} />);
    await openMenu();
    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
  });

  it('does not have loading state and shows member list after calling MemberListStore.loadInitialData', async () => {
    render(<AssigneeSelectorComponent id={GROUP_1.id} />);
    act(() => MemberListStore.loadInitialData([USER_1, USER_2]));
    await openMenu();
    expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();

    // 3 total items
    expect(screen.getAllByTestId('assignee-option')).toHaveLength(3);
    // 1 team
    expect(screen.getByText(`#${TEAM_1.slug}`)).toBeInTheDocument();
    // 2 Users including self
    expect(screen.getByText(`${USER_1.name} (You)`)).toBeInTheDocument();
    expect(screen.getByText(USER_2.name)).toBeInTheDocument();
  });

  it('does NOT update member list after initial load', async () => {
    render(<AssigneeSelectorComponent id={GROUP_1.id} />);
    act(() => MemberListStore.loadInitialData([USER_1, USER_2]));
    await openMenu();
    expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();

    expect(screen.getByText(`${USER_1.name} (You)`)).toBeInTheDocument();
    expect(screen.getByText(USER_2.name)).toBeInTheDocument();

    act(() => MemberListStore.loadInitialData([USER_1, USER_2, USER_3]));

    expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();
    expect(screen.getByText(`${USER_1.name} (You)`)).toBeInTheDocument();
    expect(screen.getByText(USER_2.name)).toBeInTheDocument();
    expect(screen.queryByText(USER_3.name)).not.toBeInTheDocument();
  });

  it('successfully assigns users', async () => {
    render(<AssigneeSelectorComponent id={GROUP_1.id} />);
    act(() => MemberListStore.loadInitialData([USER_1, USER_2]));
    await openMenu();
    expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();

    userEvent.click(screen.getByText(`${USER_1.name} (You)`));

    expect(assignMock).toHaveBeenLastCalledWith(
      '/issues/1337/',
      expect.objectContaining({
        data: {assignedTo: 'user:1', assignedBy: 'assignee_selector'},
      })
    );

    expect(await screen.findByTestId('letter_avatar-avatar')).toBeInTheDocument();
    // USER_1 initials
    expect(screen.getByTestId('assignee-selector')).toHaveTextContent('JB');
  });

  it('successfully assigns teams', async () => {
    Client.clearMockResponses();
    assignMock = Client.addMockResponse({
      method: 'PUT',
      url: `/issues/${GROUP_1.id}/`,
      body: {
        ...GROUP_1,
        assignedTo: {...TEAM_1, type: 'team'},
      },
    });
    render(<AssigneeSelectorComponent id={GROUP_1.id} />);
    act(() => MemberListStore.loadInitialData([USER_1, USER_2]));
    await openMenu();
    expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();

    userEvent.click(screen.getByText(`#${TEAM_1.slug}`));

    await waitFor(() =>
      expect(assignMock).toHaveBeenCalledWith(
        '/issues/1337/',
        expect.objectContaining({
          data: {assignedTo: 'team:3', assignedBy: 'assignee_selector'},
        })
      )
    );

    expect(await screen.findByTestId('letter_avatar-avatar')).toBeInTheDocument();
    // TEAM_1 initials
    expect(screen.getByTestId('assignee-selector')).toHaveTextContent('CT');
  });

  it('successfully clears assignment', async () => {
    render(<AssigneeSelectorComponent id={GROUP_1.id} />);
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

  it('shows invite member button', async () => {
    MemberListStore.loadInitialData([USER_1, USER_2]);
    render(<AssigneeSelectorComponent id={GROUP_1.id} />);
    jest.spyOn(ConfigStore, 'get').mockImplementation(() => true);

    await openMenu();
    expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();

    userEvent.click(await screen.findByRole('link', {name: 'Invite Member'}));
    expect(openInviteMembersModal).toHaveBeenCalled();
    ConfigStore.get.mockRestore();
  });

  it('filters user by email and selects with keyboard', async () => {
    render(<AssigneeSelectorComponent id={GROUP_2.id} />);
    act(() => MemberListStore.loadInitialData([USER_1, USER_2]));
    await openMenu();
    expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();

    userEvent.type(screen.getByRole('textbox'), 'JohnSmith@example.com');

    // 1 total item
    expect(screen.getByTestId('assignee-option')).toBeInTheDocument();
    expect(screen.getByText(`${USER_2.name}`)).toBeInTheDocument();

    userEvent.keyboard('{enter}');

    await waitFor(() =>
      expect(assignGroup2Mock).toHaveBeenLastCalledWith(
        '/issues/1338/',
        expect.objectContaining({
          data: {assignedTo: 'user:2', assignedBy: 'assignee_selector'},
        })
      )
    );

    expect(await screen.findByTestId('letter_avatar-avatar')).toBeInTheDocument();
    // USER_2 initials
    expect(screen.getByTestId('assignee-selector')).toHaveTextContent('JB');
  });

  it('successfully shows suggested assignees', async () => {
    jest.spyOn(GroupStore, 'get').mockImplementation(() => GROUP_2);
    const onAssign = jest.fn();
    render(<AssigneeSelectorComponent id={GROUP_2.id} onAssign={onAssign} />);
    act(() => MemberListStore.loadInitialData([USER_1, USER_2, USER_3]));

    expect(screen.getByTestId('suggested-avatar-stack')).toBeInTheDocument();
    // Hover over avatar
    userEvent.hover(screen.getByTestId('letter_avatar-avatar'));
    expect(await screen.findByText('Suggestion:')).toBeInTheDocument();
    expect(screen.getByText('Jane Bloggs')).toBeInTheDocument();
    expect(screen.getByText('commit data')).toBeInTheDocument();

    await openMenu();
    expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();
    expect(await screen.findByText('Suggested')).toBeInTheDocument();

    const options = screen.getAllByTestId('assignee-option');
    // Suggested assignee initials
    expect(options[0]).toHaveTextContent('JB');
    userEvent.click(options[0]);

    await waitFor(() =>
      expect(assignGroup2Mock).toHaveBeenCalledWith(
        '/issues/1338/',
        expect.objectContaining({
          data: {assignedTo: 'user:1', assignedBy: 'assignee_selector'},
        })
      )
    );

    // Suggested assignees shouldn't show anymore because we assigned to the suggested actor
    expect(screen.queryByTestId('suggested-avatar-stack')).not.toBeInTheDocument();
    expect(onAssign).toHaveBeenCalledWith(
      'member',
      expect.objectContaining({id: '1'}),
      expect.objectContaining({id: '1'})
    );
  });

  it('renders unassigned', async () => {
    jest.spyOn(GroupStore, 'get').mockImplementation(() => GROUP_1);
    render(<AssigneeSelectorComponent id={GROUP_1.id} />);

    userEvent.hover(screen.getByTestId('unassigned'));
    expect(await screen.findByText('Unassigned')).toBeInTheDocument();
  });
});
