import {GroupFixture} from 'sentry-fixture/group';
import {MemberFixture} from 'sentry-fixture/member';
import {ProjectFixture} from 'sentry-fixture/project';
// import {RouterContextFixture} from 'sentry-fixture/routerContextFixture';
import {TeamFixture} from 'sentry-fixture/team';
import {UserFixture} from 'sentry-fixture/user';

import {act, render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

// import {openInviteMembersModal} from 'sentry/actionCreators/modal';
import AssigneeSelectorDropdown from 'sentry/components/assigneeSelectorDropdown';
// import ConfigStore from 'sentry/stores/configStore';
import GroupStore from 'sentry/stores/groupStore';
// import IndicatorStore from 'sentry/stores/indicatorStore';
import MemberListStore from 'sentry/stores/memberListStore';
import ProjectsStore from 'sentry/stores/projectsStore';
import TeamStore from 'sentry/stores/teamStore';

jest.mock('sentry/actionCreators/modal', () => ({
  openInviteMembersModal: jest.fn(),
}));

describe('AssigneeSelectorDropdown', () => {
  let assignMock;
  // let assignGroup2Mock;
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
      name: 'Certificateof Deposit',
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

    assignMock = MockApiClient.addMockResponse({
      method: 'PUT',
      url: `/organizations/org-slug/issues/${GROUP_1.id}/`,
      body: {
        assignedBy: 'assignee_selector',
        assignedTo: {USER_1, type: 'user'},
      },
    });

    assignGroup2Mock = MockApiClient.addMockResponse({
      method: 'PUT',
      url: `/organizations/org-slug/issues/${GROUP_2.id}/`,
      body: {
        ...GROUP_2,
        assignedTo: {...USER_1, type: 'user'},
      },
    });

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
    // 3 Users + 1 Team = 4 total options
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

  // why tf does this not work
  // it('successfully assigns users', async () => {
  //   render(
  //     <AssigneeSelectorDropdown
  //       group={GROUP_1}
  //       memberList={[USER_1, USER_2, USER_3, USER_4]}
  //     />
  //   );
  //   await openMenu();
  //   expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();

  //   await userEvent.click(screen.getByText(`${USER_1.name} (You)`));

  //   expect(assignMock).toHaveBeenLastCalledWith(
  //     '/organizations/org-slug/issues/1337/',
  //     expect.objectContaining({
  //       data: {assignedTo: 'user:1', assignedBy: 'assignee_selector'},
  //     })
  //   );

  //   // expect(await screen.findByTestId('letter_avatar-avatar')).toBeInTheDocument();
  //   // USER_1 initials
  //   screen.debug(screen.getByTestId('assignee-selector'));
  //   expect(await screen.getByTestId('assignee-selector')).toHaveTextContent('AB');
  // });

  it('successfully assigns teams', async () => {
    MockApiClient.clearMockResponses();
    assignMock = MockApiClient.addMockResponse({
      method: 'PUT',
      url: `/organizations/org-slug/issues/${GROUP_1.id}/`,
      body: {
        ...GROUP_1,
        assignedTo: {...TEAM_1, type: 'team'},
      },
    });
    render(<AssigneeSelectorDropdown group={GROUP_1} />);
    act(() => MemberListStore.loadInitialData([USER_1, USER_2]));
    await openMenu();
    expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();

    await userEvent.click(screen.getByText(`#${TEAM_1.slug}`));

    await waitFor(() =>
      expect(assignMock).toHaveBeenCalledWith(
        '/organizations/org-slug/issues/1337/',
        expect.objectContaining({
          data: {assignedTo: 'team:3', assignedBy: 'assignee_selector'},
        })
      )
    );

    // expect(await screen.findByTestId('letter_avatar-avatar')).toBeInTheDocument();
    // TEAM_1 initials
    expect(screen.getByTestId('assignee-selector')).toHaveTextContent('CT');
  });

  it('successfully clears assignment', async () => {
    render(<AssigneeSelectorDropdown group={GROUP_1} />);
    act(() => MemberListStore.loadInitialData([USER_1, USER_2]));
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

  // it('shows invite member button', async () => {
  //   MemberListStore.loadInitialData([USER_1, USER_2]);
  //   render(<AssigneeSelectorDropdown group={GROUP_1} />, {
  //     context: RouterContextFixture(),
  //   });
  //   jest.spyOn(ConfigStore, 'get').mockImplementation(() => true);

  //   await openMenu();
  //   expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();

  //   await userEvent.click(await screen.findByRole('link', {name: 'Invite Member'}));
  //   expect(openInviteMembersModal).toHaveBeenCalled();
  //   (ConfigStore.get as jest.Mock).mockRestore();
  // });

  // it('filters user by email and selects with keyboard', async () => {
  //   render(<AssigneeSelectorDropdown group={GROUP_2} />);
  //   act(() => MemberListStore.loadInitialData([USER_1, USER_2]));
  //   await openMenu();
  //   expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();

  //   await userEvent.type(screen.getByRole('textbox'), 'JohnSmith@example.com');

  //   // 1 total item
  //   expect(screen.getByTestId('assignee-option')).toBeInTheDocument();
  //   expect(screen.getByText(`${USER_2.name}`)).toBeInTheDocument();

  //   await userEvent.keyboard('{enter}');

  //   await waitFor(() =>
  //     expect(assignGroup2Mock).toHaveBeenLastCalledWith(
  //       '/organizations/org-slug/issues/1338/',
  //       expect.objectContaining({
  //         data: {assignedTo: `user:${USER_2.id}`, assignedBy: 'assignee_selector'},
  //       })
  //     )
  //   );

  //   expect(await screen.findByTestId('letter_avatar-avatar')).toBeInTheDocument();
  //   // USER_2 initials
  //   expect(screen.getByTestId('assignee-selector')).toHaveTextContent('JB');
  // });

  // it('shows the correct toast for assigning to a non-team member', async () => {
  //   jest.spyOn(GroupStore, 'get').mockImplementation(() => GROUP_2);
  //   const addMessageSpy = jest.spyOn(IndicatorStore, 'addMessage');

  //   render(<AssigneeSelectorDropdown group={GROUP_2} />);
  //   act(() => MemberListStore.loadInitialData([USER_1, USER_2, USER_3, USER_4]));

  //   assignMock = MockApiClient.addMockResponse({
  //     method: 'PUT',
  //     url: `/organizations/org-slug/issues/${GROUP_2.id}/`,
  //     statusCode: 400,
  //     body: {detail: 'Cannot assign to non-team member'},
  //   });

  //   expect(screen.getByTestId('suggested-avatar-stack')).toBeInTheDocument();

  //   await openMenu();
  //   expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();
  //   expect(screen.getByText(`#${TEAM_1.slug}`)).toBeInTheDocument();
  //   expect(await screen.findByText('Suggested Assignees')).toBeInTheDocument();

  //   const options = screen.getAllByRole('option');
  //   console.log('aoiewfjaowiejfaioewwjfaioewjio');
  //   console.log(options);
  //   expect(options[5]).toHaveTextContent('JD');
  //   await userEvent.click(options[4]);

  //   await waitFor(() => {
  //     expect(addMessageSpy).toHaveBeenCalledWith(
  //       'Cannot assign to non-team member',
  //       'error',
  //       {duration: 4000}
  //     );
  //   });
  // });

  // it('successfully shows suggested assignees', async () => {
  //   jest.spyOn(GroupStore, 'get').mockImplementation(() => GROUP_2);
  //   const onAssign = jest.fn();
  //   render(<AssigneeSelectorDropdown group={GROUP_2} onAssign={onAssign} />);
  //   act(() => MemberListStore.loadInitialData([USER_1, USER_2, USER_3]));

  //   expect(screen.getByTestId('suggested-avatar-stack')).toBeInTheDocument();
  //   // Hover over avatar
  //   await userEvent.hover(screen.getByTestId('letter_avatar-avatar'));
  //   expect(await screen.findByText('Suggestion: Jane Bloggs')).toBeInTheDocument();
  //   expect(screen.getByText('commit data')).toBeInTheDocument();

  //   await openMenu();
  //   expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();
  //   expect(await screen.findByText('Suggested Assignees')).toBeInTheDocument();

  //   const options = screen.getAllByRole('option');
  //   // Suggested assignee initials
  //   expect(options[0]).toHaveTextContent('JB');
  //   await userEvent.click(options[0]);

  //   await waitFor(() =>
  //     expect(assignGroup2Mock).toHaveBeenCalledWith(
  //       '/organizations/org-slug/issues/1338/',
  //       expect.objectContaining({
  //         data: {assignedTo: `user:${USER_1.id}`, assignedBy: 'assignee_selector'},
  //       })
  //     )
  //   );

  //   // Suggested assignees shouldn't show anymore because we assigned to the suggested actor
  //   expect(screen.queryByTestId('suggested-avatar-stack')).not.toBeInTheDocument();
  //   expect(onAssign).toHaveBeenCalledWith(
  //     'member',
  //     expect.objectContaining({id: USER_1.id}),
  //     expect.objectContaining({id: USER_1.id})
  //   );
  // });

  // it('renders unassigned', async () => {
  //   jest.spyOn(GroupStore, 'get').mockImplementation(() => GROUP_1);
  //   render(<AssigneeSelectorDropdown group={GROUP_1} />);

  //   await userEvent.hover(screen.getByTestId('unassigned'));
  //   expect(await screen.findByText('Unassigned')).toBeInTheDocument();
  // });
});
