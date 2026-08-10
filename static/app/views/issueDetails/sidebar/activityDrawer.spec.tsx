import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {UserFixture} from 'sentry-fixture/user';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

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

  function renderDrawer(features: string[] = []) {
    return render(
      <GroupIdProvider groupId={group.id}>
        <ActivityDrawer project={project} />
      </GroupIdProvider>,
      {
        organization: OrganizationFixture({features}),
        initialRouterConfig: {
          location: {
            pathname: '/organizations/org-slug/issues/1337/activity/',
          },
        },
      }
    );
  }

  it('keeps the existing note input when the feature is disabled', async () => {
    renderDrawer();

    expect(
      await screen.findByRole('textbox', {name: 'Add a comment'})
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('combobox', {name: 'Add a comment'})
    ).not.toBeInTheDocument();
  });

  it('creates a comment with the mention composer when the feature is enabled', async () => {
    const comment = 'A comment from the drawer';
    const postMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/1337/comments/',
      method: 'POST',
      body: {
        id: 'note-2',
        type: GroupActivityType.NOTE,
        data: {text: comment},
        dateCreated: '2024-10-31T00:00:00.000000Z',
        user: UserFixture(),
      },
    });
    renderDrawer(['issue-activity-mention-input']);

    const editor = await screen.findByRole('combobox', {name: 'Add a comment'});
    // user-event does not yet recognize contenteditable="plaintext-only".
    editor.setAttribute('contenteditable', 'true');
    await userEvent.type(editor, comment);
    await userEvent.click(screen.getByRole('button', {name: 'Comment'}));

    await waitFor(() => expect(postMock).toHaveBeenCalledTimes(1));
  });
});
