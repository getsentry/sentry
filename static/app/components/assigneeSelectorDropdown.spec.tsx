import {GroupFixture} from 'sentry-fixture/group';
import {MemberFixture} from 'sentry-fixture/member';
import {ProjectFixture} from 'sentry-fixture/project';
import {RouterContextFixture} from 'sentry-fixture/routerContextFixture';
import {TeamFixture} from 'sentry-fixture/team';
import {UserFixture} from 'sentry-fixture/user';

import {act, render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {openInviteMembersModal} from 'sentry/actionCreators/modal';
import AssigneeSelectorDropdown from 'sentry/components/assigneeSelectorDropdown';
import ConfigStore from 'sentry/stores/configStore';
import GroupStore from 'sentry/stores/groupStore';
import MemberListStore from 'sentry/stores/memberListStore';
import ProjectsStore from 'sentry/stores/projectsStore';
import TeamStore from 'sentry/stores/teamStore';
import type {Group} from 'sentry/types';

jest.mock('sentry/actionCreators/modal', () => ({
  openInviteMembersModal: jest.fn(),
}));

describe('AssigneeSelectorDropdown', () => {
  let USER_1, USER_2, USER_3, USER_4;
  let TEAM_1, TEAM_2;
  let PROJECT_1;
  let GROUP_1;
  let GROUP_2;

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
    USER_4 = MemberFixture({
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

    TeamStore.reset();
    TeamStore.setTeams([TEAM_1, TEAM_2]);
    GroupStore.reset();
    GroupStore.loadInitialData([GROUP_1, GROUP_2]);

    jest.spyOn(MemberListStore, 'getAll').mockImplementation(() => []);
    jest.spyOn(GroupStore, 'get').mockImplementation(() => GROUP_1);

    // updateGroup2Store = async (_, actor, suggestedAssignee?) => {
    //   await GroupStore.onAssignToSuccess(GROUP_2.id, actor, suggestedAssignee);
    // }: OnAssignCallback

    MemberListStore.reset();
  });

  beforeEach(() => {
    ProjectsStore.loadInitialData([PROJECT_1]);
  });

  afterEach(() => {
    ProjectsStore.reset();
    MockApiClient.clearMockResponses();
  });

  // Doesn't need to always be async, but it was easier to prevent flakes this way
  const openMenu = async () => {
    await userEvent.click(await screen.findByTestId('assignee-selector'), undefined);
  };

  describe('render with props', () => {
    it('renders members from the prop when present', async () => {
      MemberListStore.loadInitialData([USER_1]);
      render(<AssigneeSelectorDropdown group={GROUP_1} memberList={[USER_2, USER_3]} />);
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
    render(<AssigneeSelectorDropdown group={GROUP_1} />);
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
    const onAssign = jest.fn();
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
        memberList={[USER_1, USER_2, USER_3, USER_4]}
        onAssign={onAssign}
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
    expect(onAssign).toHaveBeenCalledWith('user', USER_1, undefined);
    rerender(
      <AssigneeSelectorDropdown
        group={assignedGroup}
        memberList={[USER_1, USER_2, USER_3, USER_4]}
        onAssign={onAssign}
      />
    );

    expect(await screen.findByTestId('letter_avatar-avatar')).toBeInTheDocument();
    // USER_1 initials
    expect(screen.getByTestId('assignee-selector')).toHaveTextContent('AB');
  });

  it('successfully assigns teams', async () => {
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
      <AssigneeSelectorDropdown
        group={GROUP_1}
        memberList={[USER_1, USER_2, USER_3, USER_4]}
        onAssign={onAssign}
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
    expect(onAssign).toHaveBeenCalledWith(
      'team',
      {id: `team:${TEAM_1.id}`, name: TEAM_1.slug, type: 'team'},
      undefined
    );
    rerender(
      <AssigneeSelectorDropdown
        group={assignedGroup}
        memberList={[USER_1, USER_2, USER_3, USER_4]}
        onAssign={onAssign}
      />
    );

    expect(await screen.findByTestId('letter_avatar-avatar')).toBeInTheDocument();
    expect(screen.getByTestId('assignee-selector')).toHaveTextContent('CT');
  });

  it('successfully switches an assignee', async () => {
    MemberListStore.loadInitialData([USER_1, USER_2, USER_3, USER_4]);
    const onAssign = jest.fn();
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
        memberList={[USER_1, USER_2, USER_3, USER_4]}
        onAssign={onAssign}
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
    expect(onAssign).toHaveBeenCalledWith('user', USER_1, undefined);
    rerender(
      <AssigneeSelectorDropdown
        group={assignedGroupUser1}
        memberList={[USER_1, USER_2, USER_3, USER_4]}
        onAssign={onAssign}
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
    expect(onAssign).toHaveBeenCalledWith('user', USER_2, undefined);
    rerender(
      <AssigneeSelectorDropdown
        group={assignedGroupUser2}
        memberList={[USER_1, USER_2, USER_3, USER_4]}
        onAssign={onAssign}
      />
    );
    expect(screen.getByTestId('assignee-selector')).toHaveTextContent('CD');
  });

  it('successfully clears assignment', async () => {
    const onAssign = jest.fn();
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
        memberList={[USER_1, USER_2, USER_3, USER_4]}
        onAssign={onAssign}
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
    rerender(
      <AssigneeSelectorDropdown
        group={assignedGroup}
        memberList={[USER_1, USER_2, USER_3, USER_4]}
        onAssign={onAssign}
      />
    );

    await openMenu();
    await userEvent.click(screen.getByRole('button', {name: 'Clear'}));

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

  it('filters user by email and selects with keyboard', async () => {
    MemberListStore.loadInitialData([USER_1, USER_2, USER_3, USER_4]);
    const onAssign = jest.fn();
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
        memberList={[USER_1, USER_2, USER_3, USER_4]}
        onAssign={onAssign}
      />
    );
    await openMenu();
    expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();

    await userEvent.type(screen.getByRole('textbox'), 'Cert');

    // 1 total item
    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(1);
    expect(screen.getByText(`${USER_2.name}`)).toBeInTheDocument();

    await userEvent.click(screen.getByText(`${USER_2.name}`));

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
        memberList={[USER_1, USER_2, USER_3, USER_4]}
        onAssign={onAssign}
      />
    );
    expect(await screen.findByTestId('letter_avatar-avatar')).toBeInTheDocument();
    // USER_2 initials
    expect(screen.getByTestId('assignee-selector')).toHaveTextContent('CD');
  });

  it('successfully shows suggested assignees and suggestion reason', async () => {
    jest.spyOn(GroupStore, 'get').mockImplementation(() => GROUP_2);
    const onAssign = jest.fn();
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
      <AssigneeSelectorDropdown group={GROUP_2} onAssign={onAssign} />
    );

    expect(screen.getByTestId('suggested-avatar-stack')).toBeInTheDocument();
    // Hover over avatar
    await userEvent.hover(screen.getByTestId('letter_avatar-avatar'));
    expect(await screen.findByText('Suggestion: Apple Bees')).toBeInTheDocument();
    expect(screen.getByText('commit data')).toBeInTheDocument();

    await openMenu();
    expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();
    expect(await screen.findByText('Suggested Assignees')).toBeInTheDocument();

    const options = screen.getAllByRole('option');
    // Suggested assignee initials
    expect(options[0]).toHaveTextContent('AB');
    await userEvent.click(options[0]);

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
        memberList={[USER_1, USER_2, USER_3, USER_4]}
        onAssign={onAssign}
      />
    );

    // Suggested assignees shouldn't show anymore because we assigned to the suggested actor
    expect(screen.queryByTestId('suggested-avatar-stack')).not.toBeInTheDocument();
    expect(onAssign).toHaveBeenCalledWith(
      'user',
      expect.objectContaining({id: USER_1.id}),
      expect.objectContaining({id: USER_1.id})
    );
  });

  it('shows invite member button', async () => {
    MemberListStore.loadInitialData([USER_1, USER_2]);
    render(<AssigneeSelectorDropdown group={GROUP_1} />, {
      context: RouterContextFixture(),
    });
    jest.spyOn(ConfigStore, 'get').mockImplementation(() => true);

    await openMenu();
    expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();

    await userEvent.click(await screen.findByRole('button', {name: 'Invite Member'}));
    expect(openInviteMembersModal).toHaveBeenCalled();
    (ConfigStore.get as jest.Mock).mockRestore();
  });

  it('renders unassigned', async () => {
    render(<AssigneeSelectorDropdown group={GROUP_1} />);

    await userEvent.hover(screen.getByTestId('unassigned'));
    expect(await screen.findByText('Unassigned')).toBeInTheDocument();
  });
});
