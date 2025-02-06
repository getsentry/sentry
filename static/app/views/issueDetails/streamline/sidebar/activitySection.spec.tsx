import {GroupFixture} from 'sentry-fixture/group';
import {ProjectFixture} from 'sentry-fixture/project';
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

describe('StreamlinedActivitySection', function () {
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
        project,
      },
    ],
    project,
  });

  GroupStore.add([group]);

  beforeEach(() => {
    jest.restoreAllMocks();
    MockApiClient.clearMockResponses();
  });

  it('renders the input with a comment button', async function () {
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

  it('allows submitting the comment field with hotkeys', async function () {
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

  it('renders note and allows for delete', async function () {
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

  it('renders note and allows for edit', async function () {
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
          project,
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

  it('renders note but does not allow for deletion if written by someone else', async function () {
    const updatedActivityGroup = GroupFixture({
      id: '1338',
      activity: [
        {
          type: GroupActivityType.NOTE,
          id: 'note-1',
          data: {text: 'Test Note'},
          dateCreated: '2020-01-01T00:00:00',
          user: UserFixture({id: '2'}),
          project,
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

  it('collapses activity when there are more than 5 items', async function () {
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

  it('does not collapse activity when rendered in the drawer', function () {
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

  it('renders the number of comments', function () {
    render(<StreamlinedActivitySection group={{...group, numComments: 2}} />);
    expect(screen.getByLabelText('Number of comments: 2')).toBeInTheDocument();
  });
});
