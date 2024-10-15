import {GroupFixture} from 'sentry-fixture/group';
import {ProjectFixture} from 'sentry-fixture/project';
import {ReleaseFixture} from 'sentry-fixture/release';
import {UserFixture} from 'sentry-fixture/user';

import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
} from 'sentry-test/reactTestingLibrary';

import ConfigStore from 'sentry/stores/configStore';
import GroupStore from 'sentry/stores/groupStore';
import ProjectsStore from 'sentry/stores/projectsStore';
import {GroupActivityType} from 'sentry/types/group';
import StreamlinedActivitySection from 'sentry/views/issueDetails/streamline/activitySection';

describe('StreamlinedActivitySection', function () {
  const project = ProjectFixture();
  const user = UserFixture();
  user.options.prefersIssueDetailsStreamlinedUI = true;
  ConfigStore.set('user', user);

  ProjectsStore.loadInitialData([project]);
  GroupStore.init();

  const firstRelease = ReleaseFixture({id: '1'});
  const lastRelease = ReleaseFixture({id: '2'});

  const group = GroupFixture({
    id: '1337',
    activity: [
      {
        type: GroupActivityType.NOTE,
        id: 'note-1',
        data: {text: 'Test Note'},
        dateCreated: '2020-01-01T00:00:00',
        user: user,
        project,
      },
    ],
    project,
  });

  GroupStore.add([group]);

  it('renders note and allows for delete', async function () {
    const deleteMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/1337/comments/note-1/',
      method: 'DELETE',
    });

    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/issues/${group.id}/first-last-release/`,
      method: 'GET',
      body: {firstRelease, lastRelease},
    });

    render(<StreamlinedActivitySection group={group} />);
    renderGlobalModal();
    expect(await screen.findByText('Test Note')).toBeInTheDocument();

    expect(screen.getByRole('button', {name: 'Comment Actions'})).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Comment Actions'}));
    await userEvent.click(screen.getByRole('menuitemradio', {name: 'Remove'}));

    expect(
      screen.getByText('Are you sure you wish to delete this comment?')
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name: 'Confirm'}));

    expect(deleteMock).toHaveBeenCalledTimes(1);

    expect(screen.queryByText('Test Note')).not.toBeInTheDocument();
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

    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/issues/${updatedActivityGroup.id}/first-last-release/`,
      method: 'GET',
      body: {firstRelease, lastRelease},
    });

    render(<StreamlinedActivitySection group={updatedActivityGroup} />);
    expect(await screen.findByText('Test Note')).toBeInTheDocument();

    expect(
      screen.queryByRole('button', {name: 'Comment Actions'})
    ).not.toBeInTheDocument();
  });
});
