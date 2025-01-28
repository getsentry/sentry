import {GroupFixture} from 'sentry-fixture/group';
import {ProjectFixture} from 'sentry-fixture/project';
import {TeamFixture} from 'sentry-fixture/team';
import {UserFixture} from 'sentry-fixture/user';

import {act, render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {assignToActor, clearAssignment} from 'sentry/actionCreators/group';
import {openInviteMembersModal} from 'sentry/actionCreators/modal';
import AssigneeSelectorDropdown, {
  type AssignableEntity,
} from 'sentry/components/assigneeSelectorDropdown';
import ConfigStore from 'sentry/stores/configStore';
import GroupStore from 'sentry/stores/groupStore';
import MemberListStore from 'sentry/stores/memberListStore';
import ProjectsStore from 'sentry/stores/projectsStore';
import TeamStore from 'sentry/stores/teamStore';
import type {Group} from 'sentry/types/group';
import type {Team} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import type {User} from 'sentry/types/user';

jest.mock('sentry/actionCreators/modal', () => ({
  openInviteMembersModal: jest.fn(),
}));

describe('AssigneeSelectorDropdown', () => {
  let USER_1: User;
  let USER_2: User;
  let USER_3: User;
  let USER_4: User;
  let TEAM_1: Team;
  let TEAM_2: Team;
  let PROJECT_1: Project;
  let GROUP_1: Group;
  let GROUP_2: Group;
  let GROUP_3: Group;

  beforeEach(() => {
    USER_1 = UserFixture({
      id: '1',
      name: 'Apple Bees',
      email: 'applebees@example.com',
    });
    USER_2 = UserFixture({
      id: '2',
      name: 'Cert Depo',
      email: 'cd@example.com',
    });
    USER_3 = UserFixture({
      id: '3',
      name: 'Epic Fail',
      email: 'epicf@example.com',
    });
    USER_4 = UserFixture({
      id: '4',
      name: 'Git Hub',
      email: 'github@example.com',
    });

    TEAM_1 = TeamFixture({
      id: '3',
      name: 'COOL TEAM',
      slug: 'cool-team',
    });

    TEAM_2 = TeamFixture({
      id: '4',
      name: 'LAME TEAM',
      slug: 'lame-team',
    });

    PROJECT_1 = ProjectFixture({
      teams: [TEAM_1, TEAM_2],
    });

    GROUP_1 = GroupFixture({
      id: '1337',
      project: PROJECT_1,
    });

    GROUP_2 = GroupFixture({
      id: '1338',
      project: PROJECT_1,
      owners: [
        {
          type: 'suspectCommit',
          owner: `user:${USER_1.id}`,
          date_added: '',
        },
      ],
    });

    GROUP_3 = GroupFixture({
      id: '1339',
      project: PROJECT_1,
      owners: [
        {
          type: 'suspectCommit',
          owner: `user:${USER_4.id}`,
          date_added: '',
        },
      ],
    });

    TeamStore.reset();
    TeamStore.setTeams([TEAM_1, TEAM_2]);
    GroupStore.reset();
    GroupStore.loadInitialData([GROUP_1, GROUP_2]);

    jest.spyOn(MemberListStore, 'getAll').mockImplementation(() => []);
    jest.spyOn(GroupStore, 'get').mockImplementation(() => GROUP_1);

    MemberListStore.reset();

    ProjectsStore.loadInitialData([PROJECT_1]);
  });

  afterEach(() => {
    ProjectsStore.reset();
    GroupStore.reset();
    MockApiClient.clearMockResponses();
  });

  // Doesn't need to always be async, but it was easier to prevent flakes this way
  const openMenu = async () => {
    await userEvent.click(await screen.findByTestId('assignee-selector'), undefined);
  };

  const updateGroupSpy = jest.fn();

  const updateGroup = async (group: Group, newAssignee: AssignableEntity | null) => {
    updateGroupSpy(group, newAssignee);
    if (newAssignee) {
      await assignToActor({
        id: group.id,
        orgSlug: 'org-slug',
        actor: {id: newAssignee.id, type: newAssignee.type},
        assignedBy: 'assignee_selector',
      });
    } else {
      await clearAssignment(group.id, 'org-slug', 'assignee_selector');
    }
  };

  describe('render with props', () => {
    it('renders members from the prop when present', async () => {
      MemberListStore.loadInitialData([USER_1]);
      render(
        <AssigneeSelectorDropdown
          group={GROUP_1}
          memberList={[USER_2, USER_3]}
          loading={false}
          onAssign={newAssignee => updateGroup(GROUP_1, newAssignee)}
        />
      );
      await openMenu();
      expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();

      // 3 total items
      expect(screen.getAllByRole('option')).toHaveLength(4);
      // 1 team
      expect(screen.getByText(`#${TEAM_1.slug}`)).toBeInTheDocument();
      // 2 Users
      expect(screen.getByText(USER_2.name)).toBeInTheDocument();
      expect(screen.getByText(USER_3.name)).toBeInTheDocument();
    });
  });

  it('shows all user and team assignees in the correct order', async () => {
    render(
      <AssigneeSelectorDropdown
        group={GROUP_1}
        loading={false}
        onAssign={newAssignee => updateGroup(GROUP_1, newAssignee)}
      />
    );
    act(() => MemberListStore.loadInitialData([USER_1, USER_2, USER_3, USER_4]));
    await openMenu();
    expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();

    // 3 total items
    const options = screen.getAllByRole('option');
    // 4 Users + 2 Teams = 6 total options
    expect(options).toHaveLength(6);
    // Expect users to be in alphabetical order
    expect(options[0]).toHaveTextContent(`${USER_1.name} (You)`);
    expect(options[1]).toHaveTextContent(USER_2.name);
    expect(options[2]).toHaveTextContent(USER_3.name);
    expect(options[3]).toHaveTextContent(USER_4.name);
    // Expect team to be at the bottom of the list
    expect(options[4]).toHaveTextContent(TEAM_1.slug);
    expect(options[5]).toHaveTextContent(TEAM_2.slug);
  });

  it('successfully assigns users', async () => {
    // This is necessary in addition to passing in the same member list into the component
    // because the avatar component uses the member list store to get the user's avatar
    MemberListStore.loadInitialData([USER_1, USER_2, USER_3, USER_4]);
    const assignedGroup: Group = {
      ...GROUP_1,
      assignedTo: {...USER_1, type: 'user'},
    };

    const assignMock = MockApiClient.addMockResponse({
      method: 'PUT',
      url: `/organizations/org-slug/issues/${GROUP_1.id}/`,
      body: assignedGroup,
    });

    const {rerender} = render(
      <AssigneeSelectorDropdown
        group={GROUP_1}
        loading={false}
        memberList={[USER_1, USER_2, USER_3, USER_4]}
        onAssign={newAssignee => updateGroup(GROUP_1, newAssignee)}
      />
    );

    await openMenu();
    expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();

    await userEvent.click(screen.getByText(`${USER_1.name} (You)`));

    await waitFor(() =>
      expect(assignMock).toHaveBeenLastCalledWith(
        `/organizations/org-slug/issues/${GROUP_1.id}/`,
        expect.objectContaining({
          data: {assignedTo: `user:${USER_1.id}`, assignedBy: 'assignee_selector'},
        })
      )
    );
    expect(updateGroupSpy).toHaveBeenCalledWith(GROUP_1, {
      assignee: USER_1,
      id: `${USER_1.id}`,
      type: 'user',
      suggestedAssignee: undefined,
    });
    rerender(
      <AssigneeSelectorDropdown
        group={assignedGroup}
        loading={false}
        memberList={[USER_1, USER_2, USER_3, USER_4]}
        onAssign={newAssignee => updateGroup(assignedGroup, newAssignee)}
      />
    );

    expect(await screen.findByTestId('letter_avatar-avatar')).toBeInTheDocument();
    // USER_1 initials
    expect(screen.getByTestId('assignee-selector')).toHaveTextContent('AB');
  });

  it('successfully assigns teams', async () => {
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
      <AssigneeSelectorDropdown
        group={GROUP_1}
        loading={false}
        memberList={[USER_1, USER_2, USER_3, USER_4]}
        onAssign={newAssignee => updateGroup(GROUP_1, newAssignee)}
      />
    );
    await openMenu();
    expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();

    const team1slug = `#${TEAM_1.slug}`;
    await userEvent.click(screen.getByText(team1slug));

    await waitFor(() =>
      expect(assignMock).toHaveBeenCalledWith(
        `/organizations/org-slug/issues/${GROUP_1.id}/`,
        expect.objectContaining({
          data: {assignedTo: 'team:3', assignedBy: 'assignee_selector'},
        })
      )
    );
    expect(updateGroupSpy).toHaveBeenCalledWith(GROUP_1, {
      assignee: {
        id: `team:${TEAM_1.id}`,
        name: TEAM_1.slug,
        type: 'team',
      },
      id: `${TEAM_1.id}`,
      type: 'team',
      suggestedAssignee: undefined,
    });

    rerender(
      <AssigneeSelectorDropdown
        group={assignedGroup}
        loading={false}
        memberList={[USER_1, USER_2, USER_3, USER_4]}
        onAssign={newAssignee => updateGroup(assignedGroup, newAssignee)}
      />
    );

    expect(await screen.findByTestId('letter_avatar-avatar')).toBeInTheDocument();
    expect(screen.getByTestId('assignee-selector')).toHaveTextContent('CT');
  });

  it('successfully switches an assignee', async () => {
    MemberListStore.loadInitialData([USER_1, USER_2, USER_3, USER_4]);
    const assignedGroupUser1: Group = {
      ...GROUP_1,
      assignedTo: {...USER_1, type: 'user'},
    };
    const assignedGroupUser2: Group = {
      ...GROUP_1,
      assignedTo: {...USER_2, type: 'user'},
    };

    const assignMock = MockApiClient.addMockResponse({
      method: 'PUT',
      url: `/organizations/org-slug/issues/${GROUP_1.id}/`,
      body: assignedGroupUser1,
    });

    const {rerender} = render(
      <AssigneeSelectorDropdown
        group={GROUP_1}
        loading={false}
        memberList={[USER_1, USER_2, USER_3, USER_4]}
        onAssign={newAssignee => updateGroup(GROUP_1, newAssignee)}
      />
    );
    await openMenu();

    expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();
    await userEvent.click(screen.getByText(`${USER_1.name} (You)`));

    await waitFor(() =>
      expect(assignMock).toHaveBeenLastCalledWith(
        `/organizations/org-slug/issues/${GROUP_1.id}/`,
        expect.objectContaining({
          data: {assignedTo: `user:${USER_1.id}`, assignedBy: 'assignee_selector'},
        })
      )
    );

    expect(updateGroupSpy).toHaveBeenCalledWith(GROUP_1, {
      assignee: USER_1,
      id: `${USER_1.id}`,
      type: 'user',
      suggestedAssignee: undefined,
    });

    rerender(
      <AssigneeSelectorDropdown
        group={assignedGroupUser1}
        loading={false}
        memberList={[USER_1, USER_2, USER_3, USER_4]}
        onAssign={newAssignee => updateGroup(assignedGroupUser1, newAssignee)}
      />
    );

    expect(await screen.findByTestId('letter_avatar-avatar')).toBeInTheDocument();
    expect(screen.getByTestId('assignee-selector')).toHaveTextContent('AB');

    await openMenu();
    expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();
    await userEvent.click(screen.getByText(USER_2.name));

    await waitFor(() =>
      expect(assignMock).toHaveBeenLastCalledWith(
        `/organizations/org-slug/issues/${GROUP_1.id}/`,
        expect.objectContaining({
          data: {assignedTo: `user:${USER_2.id}`, assignedBy: 'assignee_selector'},
        })
      )
    );
    expect(updateGroupSpy).toHaveBeenCalledWith(GROUP_1, {
      assignee: USER_1,
      id: `${USER_1.id}`,
      type: 'user',
      suggestedAssignee: undefined,
    });
    rerender(
      <AssigneeSelectorDropdown
        group={assignedGroupUser2}
        loading={false}
        memberList={[USER_1, USER_2, USER_3, USER_4]}
        onAssign={newAssignee => updateGroup(assignedGroupUser2, newAssignee)}
      />
    );
    expect(screen.getByTestId('assignee-selector')).toHaveTextContent('CD');
  });

  it('successfully clears assignment', async () => {
    const assignedGroup: Group = {
      ...GROUP_1,
      assignedTo: {...USER_2, type: 'user'},
    };

    const assignMock = MockApiClient.addMockResponse({
      method: 'PUT',
      url: `/organizations/org-slug/issues/${GROUP_1.id}/`,
      body: assignedGroup,
    });

    const {rerender} = render(
      <AssigneeSelectorDropdown
        group={GROUP_1}
        loading={false}
        memberList={[USER_1, USER_2, USER_3, USER_4]}
        onAssign={newAssignee => updateGroup(GROUP_1, newAssignee)}
      />
    );
    await openMenu();

    await userEvent.click(screen.getByText(USER_2.name));

    await waitFor(() =>
      expect(assignMock).toHaveBeenCalledWith(
        `/organizations/org-slug/issues/${GROUP_1.id}/`,
        expect.objectContaining({
          data: {assignedTo: 'user:2', assignedBy: 'assignee_selector'},
        })
      )
    );
    expect(assignMock).toHaveBeenCalledTimes(1);
    assignMock.mockClear();

    rerender(
      <AssigneeSelectorDropdown
        group={assignedGroup}
        loading={false}
        memberList={[USER_1, USER_2, USER_3, USER_4]}
        onAssign={newAssignee => updateGroup(assignedGroup, newAssignee)}
        onClear={() => updateGroup(assignedGroup, null)}
      />
    );

    await openMenu();
    await userEvent.click(screen.getByRole('button', {name: 'Clear'}));

    // api was called with empty string, clearing assignment
    await waitFor(() =>
      expect(assignMock).toHaveBeenCalledWith(
        '/organizations/org-slug/issues/1337/',
        expect.objectContaining({
          data: {assignedTo: '', assignedBy: 'assignee_selector'},
        })
      )
    );
    expect(assignMock).toHaveBeenCalledTimes(1);
  });

  it('filters user by email and selects with keyboard', async () => {
    MemberListStore.loadInitialData([USER_1, USER_2, USER_3, USER_4]);
    const assignedGroup: Group = {
      ...GROUP_2,
      assignedTo: {...USER_2, type: 'user'},
    };

    const assignMock = MockApiClient.addMockResponse({
      method: 'PUT',
      url: `/organizations/org-slug/issues/${GROUP_2.id}/`,
      body: assignedGroup,
    });

    const {rerender} = render(
      <AssigneeSelectorDropdown
        group={GROUP_2}
        loading={false}
        memberList={[USER_1, USER_2, USER_3, USER_4]}
        onAssign={newAssignee => updateGroup(GROUP_2, newAssignee)}
      />
    );
    await openMenu();
    expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();

    await userEvent.type(screen.getByRole('textbox'), 'Cert');

    // 1 total item
    await waitFor(() => {
      expect(screen.getAllByRole('option')).toHaveLength(1);
    });

    expect(await screen.findByText(`${USER_2.name}`)).toBeInTheDocument();

    await userEvent.click(await screen.findByText(`${USER_2.name}`));

    await waitFor(() =>
      expect(assignMock).toHaveBeenLastCalledWith(
        `/organizations/org-slug/issues/${GROUP_2.id}/`,
        expect.objectContaining({
          data: {assignedTo: `user:${USER_2.id}`, assignedBy: 'assignee_selector'},
        })
      )
    );
    rerender(
      <AssigneeSelectorDropdown
        group={assignedGroup}
        loading={false}
        memberList={[USER_1, USER_2, USER_3, USER_4]}
        onAssign={newAssignee => updateGroup(assignedGroup, newAssignee)}
      />
    );
    expect(await screen.findByTestId('letter_avatar-avatar')).toBeInTheDocument();
    // USER_2 initials
    expect(screen.getByTestId('assignee-selector')).toHaveTextContent('CD');
  });

  it('filters users based on their email address', async () => {
    MemberListStore.loadInitialData([USER_1, USER_2, USER_3, USER_4]);
    render(
      <AssigneeSelectorDropdown
        group={GROUP_2}
        loading={false}
        memberList={[USER_1, USER_2, USER_3, USER_4]}
        onAssign={newAssignee => updateGroup(GROUP_2, newAssignee)}
      />
    );
    await openMenu();
    expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();

    await userEvent.type(screen.getByRole('textbox'), 'github@example.com');

    // 1 total item
    await waitFor(() => {
      expect(screen.getAllByRole('option')).toHaveLength(1);
    });

    expect(await screen.findByText(`${USER_4.name}`)).toBeInTheDocument();
  });

  it('successfully shows suggested assignees and suggestion reason', async () => {
    jest.spyOn(GroupStore, 'get').mockImplementation(() => GROUP_2);

    MemberListStore.loadInitialData([USER_1, USER_2, USER_3]);

    const assignedGroup: Group = {
      ...GROUP_2,
      assignedTo: {...USER_1, type: 'user'},
    };

    const assignGroup2Mock = MockApiClient.addMockResponse({
      method: 'PUT',
      url: `/organizations/org-slug/issues/${GROUP_2.id}/`,
      body: {
        ...GROUP_2,
        assignedBy: 'assignee_selector',
        assignedTo: {assignedTo: USER_1, type: 'user'},
      },
    });

    const {rerender} = render(
      <AssigneeSelectorDropdown
        group={GROUP_2}
        loading={false}
        onAssign={newAssignee => updateGroup(GROUP_2, newAssignee)}
      />
    );

    expect(screen.getByTestId('suggested-avatar-stack')).toBeInTheDocument();
    // Hover over avatar
    await userEvent.hover(await screen.findByTestId('letter_avatar-avatar'));
    expect(await screen.findByText('Suggestion: Apple Bees')).toBeInTheDocument();
    expect(await screen.findByText('commit data')).toBeInTheDocument();

    await openMenu();
    expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();
    expect(await screen.findByText('Suggested')).toBeInTheDocument();

    const options = await screen.findAllByRole('option');

    // Suggested assignee initials
    expect(options[0]).toHaveTextContent('AB');
    await userEvent.click(options[0]!);

    await waitFor(() =>
      expect(assignGroup2Mock).toHaveBeenCalledWith(
        '/organizations/org-slug/issues/1338/',
        expect.objectContaining({
          data: {assignedTo: `user:${USER_1.id}`, assignedBy: 'assignee_selector'},
        })
      )
    );

    rerender(
      <AssigneeSelectorDropdown
        group={assignedGroup}
        loading={false}
        memberList={[USER_1, USER_2, USER_3, USER_4]}
        onAssign={newAssignee => updateGroup(assignedGroup, newAssignee)}
      />
    );

    // Suggested assignees shouldn't show anymore because we assigned to the suggested actor    expect(screen.getByTestId('suggested-avatar-stack')).not.toBeInTheDocument();

    expect(updateGroupSpy).toHaveBeenCalledWith(GROUP_2, {
      assignee: USER_1,
      id: `${USER_1.id}`,
      type: 'user',
      suggestedAssignee: expect.objectContaining({id: USER_1.id}),
    });
  });

  it('shows the suggested assignee even if they would be cut off by the size limit', async () => {
    jest.spyOn(GroupStore, 'get').mockImplementation(() => GROUP_3);

    MemberListStore.loadInitialData([USER_1, USER_2, USER_3, USER_4]);

    render(
      <AssigneeSelectorDropdown
        group={GROUP_3}
        loading={false}
        onAssign={newAssignee => updateGroup(GROUP_3, newAssignee)}
        sizeLimit={2}
      />
    );

    expect(screen.getByTestId('suggested-avatar-stack')).toBeInTheDocument();
    // Hover over avatar
    await userEvent.hover(await screen.findByTestId('letter_avatar-avatar'));
    expect(await screen.findByText('Suggestion: Git Hub')).toBeInTheDocument();
    expect(await screen.findByText('commit data')).toBeInTheDocument();

    await openMenu();
    // User 4, Git Hub, would have normally been cut off by the the size limit since it is
    // alphabetically last, but it should still be shown because it is a suggested assignee
    const options = await screen.findAllByRole('option');
    expect(options).toHaveLength(2);
    expect(options[0]).toHaveTextContent('GH');
  });

  it('shows invite member button', async () => {
    MemberListStore.loadInitialData([USER_1, USER_2]);
    render(
      <AssigneeSelectorDropdown
        group={GROUP_1}
        loading={false}
        onAssign={newAssignee => updateGroup(GROUP_1, newAssignee)}
      />
    );
    jest.spyOn(ConfigStore, 'get').mockImplementation(() => true);

    await openMenu();
    expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();

    await userEvent.click(await screen.findByRole('button', {name: 'Invite Member'}));
    expect(openInviteMembersModal).toHaveBeenCalled();
    jest.mocked(ConfigStore.get).mockRestore();
  });

  it('renders unassigned', async () => {
    render(
      <AssigneeSelectorDropdown
        group={GROUP_1}
        loading={false}
        onAssign={newAssignee => updateGroup(GROUP_1, newAssignee)}
      />
    );

    await userEvent.hover(screen.getByTestId('unassigned'));
    expect(await screen.findByText('Unassigned')).toBeInTheDocument();
  });
});
