import {ActivityFeedFixture} from 'sentry-fixture/activityFeed';
import {GroupFixture} from 'sentry-fixture/group';
import {ProjectFixture} from 'sentry-fixture/project';
import {UserFixture} from 'sentry-fixture/user';

import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import {TeamStore} from 'sentry/stores/teamStore';
import {GroupActivityType} from 'sentry/types/group';
import {GroupIdProvider} from 'sentry/views/issueDetails/groupIdContext';
import {ActivityDrawer} from 'sentry/views/issueDetails/sidebar/activityDrawer';

describe('ActivityDrawer', () => {
  const project = ProjectFixture();
  const group = GroupFixture({id: '1337', project});

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    TeamStore.reset();
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/1337/',
      body: group,
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/members/',
      body: [],
    });
  });

  function renderDrawer() {
    return render(
      <GroupIdProvider groupId={group.id}>
        <ActivityDrawer project={project} />
      </GroupIdProvider>,
      {
        initialRouterConfig: {
          location: {
            pathname: '/organizations/org-slug/issues/1337/activity/',
          },
        },
      }
    );
  }

  it('creates, edits, and deletes a comment by reference in the cached activity', async () => {
    const comment = 'A comment from the drawer';
    const note = ActivityFeedFixture({
      id: '987',
      commentId: '123',
      data: {text: comment},
      user: UserFixture(),
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/1337/',
      body: GroupFixture({
        ...group,
        numComments: 0,
        activity: [
          ActivityFeedFixture({
            id: '123',
            type: GroupActivityType.SET_RESOLVED,
            data: {},
          }),
        ],
      }),
    });
    const postMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/1337/comments/',
      method: 'POST',
      body: note,
    });
    const editMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/1337/comments/123/',
      method: 'PUT',
      // An Activity-backed response can have a different row id from the cached GALE.
      body: {...note, id: '123', data: {text: 'Updated comment'}},
    });
    const deleteMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/1337/comments/123/',
      method: 'DELETE',
    });
    renderDrawer();

    const editor = await screen.findByRole('combobox', {name: 'Add a comment'});
    // user-event does not yet recognize contenteditable="plaintext-only".
    editor.setAttribute('contenteditable', 'true');
    await userEvent.type(editor, comment);
    await userEvent.click(screen.getByRole('button', {name: 'Comment'}));

    await waitFor(() => expect(postMock).toHaveBeenCalledTimes(1));
    expect(await screen.findByText(comment)).toBeInTheDocument();
    expect(screen.getByLabelText('1 comment')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Comment Actions'}));
    await userEvent.click(screen.getByRole('menuitemradio', {name: 'Edit'}));
    const editInput = screen.getByRole('combobox', {name: 'Edit comment'});
    editInput.setAttribute('contenteditable', 'true');
    await userEvent.clear(editInput);
    await userEvent.type(editInput, 'Updated comment');
    await userEvent.click(screen.getByRole('button', {name: 'Save comment'}));

    expect(await screen.findByText('Updated comment')).toBeInTheDocument();
    expect(editMock).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Resolved')).toBeInTheDocument();
    expect(screen.getByLabelText('1 comment')).toBeInTheDocument();

    renderGlobalModal();
    await userEvent.click(screen.getByRole('button', {name: 'Comment Actions'}));
    await userEvent.click(screen.getByRole('menuitemradio', {name: 'Remove'}));
    await userEvent.click(screen.getByRole('button', {name: 'Remove comment'}));

    await waitFor(() => expect(deleteMock).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(screen.queryByText('Updated comment')).not.toBeInTheDocument()
    );
    expect(screen.getByText('Resolved')).toBeInTheDocument();
    expect(screen.queryByLabelText('1 comment')).not.toBeInTheDocument();
  });
});
