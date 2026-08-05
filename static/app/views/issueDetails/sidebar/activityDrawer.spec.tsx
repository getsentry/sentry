import {GroupFixture} from 'sentry-fixture/group';
import {ProjectFixture} from 'sentry-fixture/project';
import {UserFixture} from 'sentry-fixture/user';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {GroupActivityType, type GroupActivity} from 'sentry/types/group';
import {GroupIdProvider} from 'sentry/views/issueDetails/groupIdContext';
import {ActivityDrawer} from 'sentry/views/issueDetails/sidebar/activityDrawer';

describe('ActivityDrawer', () => {
  const project = ProjectFixture();
  const user = UserFixture();

  function makeComment(id: string, text: string): GroupActivity {
    return {
      id,
      type: GroupActivityType.NOTE,
      data: {text},
      dateCreated: '2020-01-01T00:00:00',
      user,
    };
  }

  function renderDrawer(group = GroupFixture({id: '1337', project})) {
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/issues/${group.id}/`,
      body: group,
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/members/',
      body: [],
    });

    return render(
      <GroupIdProvider groupId={group.id}>
        <ActivityDrawer project={project} />
      </GroupIdProvider>,
      {
        initialRouterConfig: {
          location: {
            pathname: `/organizations/org-slug/issues/${group.id}/activity/`,
            query: {filter: 'comments'},
          },
        },
      }
    );
  }

  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('loads every page from the comments endpoint', async () => {
    const group = GroupFixture({id: '1337', numComments: 2, project});
    const commentsUrl = '/organizations/org-slug/issues/1337/comments/';
    const firstPageMock = MockApiClient.addMockResponse({
      url: commentsUrl,
      body: [makeComment('comment-2', 'Most recent comment')],
      headers: {
        Link: `<${commentsUrl}?cursor=0:100:0>; rel="next"; results="true"; cursor="0:100:0"`,
      },
      match: [MockApiClient.matchQuery({cursor: undefined})],
    });
    const secondPageMock = MockApiClient.addMockResponse({
      url: commentsUrl,
      body: [makeComment('comment-1', 'Older comment')],
      headers: {
        Link: `<${commentsUrl}?cursor=0:200:0>; rel="next"; results="false"; cursor="0:200:0"`,
      },
      match: [MockApiClient.matchQuery({cursor: '0:100:0'})],
    });

    renderDrawer(group);

    expect(await screen.findByText('Most recent comment')).toBeInTheDocument();
    expect(await screen.findByText('Older comment')).toBeInTheDocument();
    expect(firstPageMock).toHaveBeenCalledTimes(1);
    expect(secondPageMock).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('radio', {name: /Comments/})).toBeChecked();
    expect(screen.getByLabelText('2 comments')).toHaveTextContent('2');
    expect(screen.getByRole('radio', {name: 'All activity'})).toBeInTheDocument();
  });

  it('invalidates comments after posting a comment', async () => {
    const group = GroupFixture({id: '1337', numComments: 1, project});
    const commentsUrl = '/organizations/org-slug/issues/1337/comments/';
    const firstComment = makeComment('comment-1', 'Existing comment');
    const newComment = makeComment('comment-2', 'New comment');
    MockApiClient.addMockResponse({url: commentsUrl, body: [firstComment]});
    MockApiClient.addMockResponse({
      url: commentsUrl,
      method: 'POST',
      body: newComment,
    });

    renderDrawer(group);
    expect(await screen.findByText('Existing comment')).toBeInTheDocument();

    const refreshedCommentsMock = MockApiClient.addMockResponse({
      url: commentsUrl,
      body: [newComment, firstComment],
    });

    const input = screen.getByPlaceholderText(
      'Add a comment. Tag users with @, or teams with #'
    );
    await userEvent.type(input, 'New comment');
    await userEvent.click(screen.getByRole('button', {name: 'Comment'}));

    expect(await screen.findByText('New comment')).toBeInTheDocument();
    await waitFor(() => expect(refreshedCommentsMock).toHaveBeenCalledTimes(1));
    expect(screen.getByLabelText('2 comments')).toHaveTextContent('2');
  });

  it('invalidates comments after editing a comment', async () => {
    const group = GroupFixture({id: '1337', numComments: 1, project});
    const commentsUrl = '/organizations/org-slug/issues/1337/comments/';
    const originalComment = makeComment('comment-1', 'Original comment');
    const editedComment = makeComment('comment-1', 'Edited comment');
    MockApiClient.addMockResponse({url: commentsUrl, body: [originalComment]});
    MockApiClient.addMockResponse({
      url: `${commentsUrl}comment-1/`,
      method: 'PUT',
      body: editedComment,
    });

    renderDrawer(group);
    expect(await screen.findByText('Original comment')).toBeInTheDocument();

    const refreshedCommentsMock = MockApiClient.addMockResponse({
      url: commentsUrl,
      body: [editedComment],
    });

    await userEvent.click(screen.getByRole('button', {name: 'Comment Actions'}));
    await userEvent.click(screen.getByRole('menuitemradio', {name: 'Edit'}));
    const input = screen.getByDisplayValue('Original comment');
    await userEvent.clear(input);
    await userEvent.type(input, 'Edited comment');
    await userEvent.click(screen.getByRole('button', {name: 'Save'}));

    expect(await screen.findByText('Edited comment')).toBeInTheDocument();
    await waitFor(() => expect(refreshedCommentsMock).toHaveBeenCalledTimes(1));
  });
});
