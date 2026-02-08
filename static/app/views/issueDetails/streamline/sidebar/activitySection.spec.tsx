import {GroupFixture} from 'sentry-fixture/group';
import {ProjectFixture} from 'sentry-fixture/project';
import {SentryAppFixture} from 'sentry-fixture/sentryApp';
import {UserFixture} from 'sentry-fixture/user';

import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
} from 'sentry-test/reactTestingLibrary';

import * as indicators from 'sentry/actionCreators/indicator';
import ConfigStore from 'sentry/stores/configStore';
import GroupStore from 'sentry/stores/groupStore';
import ProjectsStore from 'sentry/stores/projectsStore';
import type {GroupActivity} from 'sentry/types/group';
import {GroupActivityType} from 'sentry/types/group';
import StreamlinedActivitySection from 'sentry/views/issueDetails/streamline/sidebar/activitySection';

describe('StreamlinedActivitySection', () => {
  const project = ProjectFixture();
  const user = UserFixture();
  user.options.prefersIssueDetailsStreamlinedUI = true;
  ConfigStore.set('user', user);

  ProjectsStore.loadInitialData([project]);
  GroupStore.init();

  const group = GroupFixture({
    id: '1337',
    activity: [
      {
        type: GroupActivityType.NOTE,
        id: 'note-1',
        data: {text: 'Test Note'},
        dateCreated: '2020-01-01T00:00:00',
        user,
      },
    ],
    project,
  });

  GroupStore.add([group]);

  beforeEach(() => {
    jest.restoreAllMocks();
    MockApiClient.clearMockResponses();
    localStorage.clear();
  });

  it('renders the input with a comment button', async () => {
    const comment = 'nice work friends';
    const postMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/1337/comments/',
      method: 'POST',
      body: {
        id: 'note-2',
        user: UserFixture({id: '2'}),
        type: 'note',
        data: {text: comment},
        dateCreated: '2024-10-31T00:00:00.000000Z',
      },
    });

    render(<StreamlinedActivitySection group={group} />);

    const commentInput = screen.getByRole('textbox', {name: 'Add a comment'});
    expect(commentInput).toBeInTheDocument();
    expect(
      screen.queryByRole('button', {name: 'Submit comment'})
    ).not.toBeInTheDocument();

    await userEvent.click(commentInput);

    // Button appears after input is focused
    const submitButton = await screen.findByRole('button', {name: 'Submit comment'});
    expect(submitButton).toBeInTheDocument();

    expect(submitButton).toBeDisabled();
    await userEvent.type(commentInput, comment);
    expect(submitButton).toBeEnabled();

    await userEvent.click(submitButton);
    expect(postMock).toHaveBeenCalled();
  });

  it('allows submitting the comment field with hotkeys', async () => {
    const comment = 'nice work friends';
    const postMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/1337/comments/',
      method: 'POST',
      body: {
        id: 'note-3',
        user: UserFixture({id: '2'}),
        type: 'note',
        data: {text: comment},
        dateCreated: '2024-10-31T00:00:00.000000Z',
      },
    });

    render(<StreamlinedActivitySection group={group} />);

    const commentInput = screen.getByRole('textbox', {name: 'Add a comment'});
    await userEvent.type(commentInput, comment);
    await userEvent.keyboard('{Meta>}{Enter}{/Meta}');
    expect(postMock).toHaveBeenCalled();
  });

  it('renders note and allows for delete', async () => {
    const deleteMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/1337/comments/note-1/',
      method: 'DELETE',
    });

    render(<StreamlinedActivitySection group={group} />);
    renderGlobalModal();
    expect(await screen.findByText('Test Note')).toBeInTheDocument();

    expect(screen.getByRole('button', {name: 'Comment Actions'})).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Comment Actions'}));
    await userEvent.click(screen.getByRole('menuitemradio', {name: 'Remove'}));

    expect(
      screen.getByText('Are you sure you want to remove this comment?')
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name: 'Remove comment'}));

    expect(deleteMock).toHaveBeenCalledTimes(1);

    expect(screen.queryByText('Test Note')).not.toBeInTheDocument();
  });

  it('renders note and allows for edit', async () => {
    jest.spyOn(indicators, 'addSuccessMessage');

    const editGroup = GroupFixture({
      id: '1123',
      activity: [
        {
          type: GroupActivityType.NOTE,
          id: 'note-1',
          data: {text: 'Group Test'},
          dateCreated: '2020-01-01T00:00:00',
          user,
        },
      ],
      project,
    });
    const editMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/1123/comments/note-1/',
      method: 'PUT',
      body: {
        id: 'note-1',
        data: {text: 'Group Test Updated'},
      },
    });

    render(<StreamlinedActivitySection group={editGroup} />);
    expect(await screen.findByText('Group Test')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Comment Actions'}));
    await userEvent.click(screen.getByRole('menuitemradio', {name: 'Edit'}));

    await userEvent.type(screen.getByRole('textbox', {name: 'Edit comment'}), ' Updated');
    await userEvent.click(screen.getByRole('button', {name: 'Cancel'}));

    expect(editMock).not.toHaveBeenCalled();

    expect(await screen.findByText('Group Test')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Comment Actions'}));
    await userEvent.click(screen.getByRole('menuitemradio', {name: 'Edit'}));

    await userEvent.type(screen.getByRole('textbox', {name: 'Edit comment'}), ' Updated');
    await userEvent.click(screen.getByRole('button', {name: 'Save comment'}));

    expect(editMock).toHaveBeenCalledTimes(1);
    expect(indicators.addSuccessMessage).toHaveBeenCalledWith('Comment updated');
  });

  it('renders note from a sentry app', async () => {
    const newUser = UserFixture({name: 'sentry-app-proxy-user-abcd123'});
    const sentryApp = SentryAppFixture({
      name: 'Bug Bot',
      avatars: [
        {
          avatarType: 'upload',
          avatarUrl: 'https://example.com/avatar.png',
          avatarUuid: '1234567890',
          photoType: 'icon',
          color: true,
        },
      ],
    });
    const newGroup = GroupFixture({
      activity: [
        {
          type: GroupActivityType.NOTE,
          id: 'note-1',
          data: {text: 'This note came from my sentry app'},
          dateCreated: '2020-01-01T00:00:00',
          sentry_app: sentryApp,
          user: newUser,
        },
      ],
    });

    render(<StreamlinedActivitySection group={newGroup} />);
    expect(
      await screen.findByText('This note came from my sentry app')
    ).toBeInTheDocument();
    expect(screen.getByTestId('upload-avatar')).toBeInTheDocument();
    expect(screen.getByText(sentryApp.name)).toBeInTheDocument();
    // We should not show the user, if a sentry app is attached
    expect(screen.queryByText(newUser.name)).not.toBeInTheDocument();
  });

  it('renders note but does not allow for deletion if written by someone else', async () => {
    const updatedActivityGroup = GroupFixture({
      id: '1338',
      activity: [
        {
          type: GroupActivityType.NOTE,
          id: 'note-1',
          data: {text: 'Test Note'},
          dateCreated: '2020-01-01T00:00:00',
          user: UserFixture({id: '2'}),
        },
      ],
      project,
    });

    render(<StreamlinedActivitySection group={updatedActivityGroup} />);
    expect(await screen.findByText('Test Note')).toBeInTheDocument();

    expect(
      screen.queryByRole('button', {name: 'Comment Actions'})
    ).not.toBeInTheDocument();
  });

  it('collapses activity when there are more than 5 items', async () => {
    const activities: GroupActivity[] = Array.from({length: 7}, (_, index) => ({
      type: GroupActivityType.NOTE,
      id: `note-${index + 1}`,
      data: {text: `Test Note ${index + 1}`},
      dateCreated: '2020-01-01T00:00:00',
      user: UserFixture({id: '2'}),
      project,
    }));

    const updatedActivityGroup = GroupFixture({
      id: '1338',
      activity: activities,
      project,
    });

    render(<StreamlinedActivitySection group={updatedActivityGroup} />);
    expect(await screen.findByText('Test Note 1')).toBeInTheDocument();
    expect(await screen.findByText('Test Note 3')).toBeInTheDocument();
    expect(screen.queryByText('Test Note 7')).not.toBeInTheDocument();
    expect(await screen.findByText('View 4 more')).toBeInTheDocument();
  });

  it('does not collapse activity when rendered in the drawer', () => {
    const activities: GroupActivity[] = Array.from({length: 7}, (_, index) => ({
      type: GroupActivityType.NOTE,
      id: `note-${index + 1}`,
      data: {text: `Test Note ${index + 1}`},
      dateCreated: '2020-01-01T00:00:00',
      user: UserFixture({id: '2'}),
      project,
    }));

    const updatedActivityGroup = GroupFixture({
      id: '1338',
      activity: activities,
      project,
    });

    render(<StreamlinedActivitySection group={updatedActivityGroup} isDrawer />);

    for (const activity of activities) {
      expect(
        screen.getByText((activity.data as {text: string}).text)
      ).toBeInTheDocument();
    }

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('filters comments correctly', () => {
    const activities: GroupActivity[] = Array.from({length: 3}, (_, index) => ({
      type: GroupActivityType.NOTE,
      id: `note-${index + 1}`,
      data: {text: `Test Note ${index + 1}`},
      dateCreated: '2020-01-01T00:00:00',
      user: UserFixture({id: '2'}),
      project,
    }));

    activities.push({
      type: GroupActivityType.SET_RESOLVED,
      id: 'resolved-1',
      data: {text: 'Resolved'},
      dateCreated: '2020-01-01T00:00:00',
      user,
    });

    const updatedActivityGroup = GroupFixture({
      id: '1338',
      activity: activities,
      project,
    });

    render(
      <StreamlinedActivitySection group={updatedActivityGroup} isDrawer filterComments />
    );

    for (const activity of activities) {
      if (activity.type === GroupActivityType.SET_RESOLVED) {
        expect(screen.queryByText('Resolved')).not.toBeInTheDocument();
      } else {
        expect(
          screen.getByText((activity.data as {text: string}).text)
        ).toBeInTheDocument();
      }
    }
  });

  it('renders resolved in release with integration', async () => {
    const resolvedGroup = GroupFixture({
      id: '1339',
      activity: [
        {
          type: GroupActivityType.SET_RESOLVED_IN_RELEASE,
          id: 'resolved-in-release-1',
          dateCreated: '2020-01-01T00:00:00',
          data: {
            version: 'frontend@1.0.0',
            integration_id: 408,
            provider: 'Jira Server',
            provider_key: 'jira_server',
          },
          user,
        },
      ],
      project,
    });

    render(<StreamlinedActivitySection group={resolvedGroup} />);
    expect(await screen.findByText('Resolved')).toBeInTheDocument();
    expect(screen.getByRole('link', {name: '1.0.0'})).toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'Jira Server'})).toBeInTheDocument();
  });

  it('renders resolved in release without integration', async () => {
    const resolvedGroup = GroupFixture({
      id: '1340',
      activity: [
        {
          type: GroupActivityType.SET_RESOLVED_IN_RELEASE,
          id: 'resolved-in-release-2',
          dateCreated: '2020-01-01T00:00:00',
          data: {
            version: 'frontend@1.0.0',
          },
          user,
        },
      ],
      project,
    });

    render(<StreamlinedActivitySection group={resolvedGroup} />);
    expect(await screen.findByText('Resolved')).toBeInTheDocument();
    expect(screen.getByRole('link', {name: '1.0.0'})).toBeInTheDocument();
  });
});
