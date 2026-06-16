import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {UserFixture} from 'sentry-fixture/user';

import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
} from 'sentry-test/reactTestingLibrary';

import {FeedbackActivitySection} from 'sentry/components/feedback/feedbackItem/feedbackActivitySection';
import {FeedbackApiOptions} from 'sentry/components/feedback/useFeedbackApiOptions';
import {GroupActivityType, IssueCategory} from 'sentry/types/group';

describe('FeedbackActivitySection', () => {
  const organization = OrganizationFixture();
  const project = ProjectFixture();
  const user = UserFixture();

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/members/',
      body: [{user}],
    });
  });

  it('renders feedback activity with the issue details activity feed', async () => {
    const feedbackItem = GroupFixture({
      id: '1337',
      activity: [
        {
          type: GroupActivityType.NOTE,
          id: 'note-1',
          data: {text: 'Existing feedback note'},
          dateCreated: '2020-01-01T00:00:00',
          user,
        },
      ],
      project,
    });

    render(
      <FeedbackApiOptions organization={organization}>
        <FeedbackActivitySection feedbackItem={feedbackItem} />
      </FeedbackApiOptions>,
      {organization}
    );

    const commentInput = screen.getByPlaceholderText(
      /Add details or updates to this feedback/
    );

    expect(commentInput).toBeInTheDocument();
    expect(screen.getByText('Existing feedback note')).toBeInTheDocument();
    expect(screen.getByTestId('activity-timeline')).not.toContainElement(
      screen.getByTestId('activity-input-frame')
    );

    await userEvent.click(commentInput);

    expect(screen.getByRole('radio', {name: 'Write'})).toBeInTheDocument();
    expect(screen.getByRole('radio', {name: 'Preview'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Comment'})).toBeInTheDocument();
  });

  it('posts comments through the feedback activity mutation', async () => {
    const comment = 'feedback follow up';
    const feedbackItem = GroupFixture({
      id: '1337',
      activity: [],
      project,
    });
    const postMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/1337/comments/',
      method: 'POST',
      body: {
        id: 'note-2',
        user,
        type: 'note',
        data: {text: comment},
        dateCreated: '2024-10-31T00:00:00.000000Z',
      },
    });

    render(
      <FeedbackApiOptions organization={organization}>
        <FeedbackActivitySection feedbackItem={feedbackItem} />
      </FeedbackApiOptions>,
      {organization}
    );

    await userEvent.type(screen.getByRole('textbox'), comment);
    await userEvent.click(screen.getByRole('button', {name: 'Comment'}));

    expect(postMock).toHaveBeenCalledWith(
      '/organizations/org-slug/issues/1337/comments/',
      expect.objectContaining({
        method: 'POST',
        data: {
          text: comment,
          mentions: [],
        },
      })
    );
  });

  it('keeps the framed input when editing a comment', async () => {
    const feedbackItem = GroupFixture({
      id: '1337',
      activity: [
        {
          type: GroupActivityType.NOTE,
          id: 'note-1',
          data: {text: 'Existing feedback note'},
          dateCreated: '2020-01-01T00:00:00',
          user,
        },
      ],
      project,
    });

    render(
      <FeedbackApiOptions organization={organization}>
        <FeedbackActivitySection feedbackItem={feedbackItem} />
      </FeedbackApiOptions>,
      {organization}
    );
    renderGlobalModal();

    await userEvent.click(screen.getByRole('button', {name: 'Comment Actions'}));
    await userEvent.click(screen.getByRole('menuitemradio', {name: 'Edit'}));

    const editInput = screen.getByDisplayValue('Existing feedback note');
    const editFrame = screen
      .getAllByTestId('activity-input-frame')
      .find(frame => frame.contains(editInput));

    expect(editFrame).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Cancel'})).toBeEnabled();
  });

  it('renders ignored feedback activity as spam', async () => {
    const feedbackItem = GroupFixture({
      id: '1337',
      activity: [
        {
          type: GroupActivityType.SET_IGNORED,
          id: 'spam-1',
          data: {},
          dateCreated: '2020-01-01T00:00:00',
          user,
        },
      ],
      issueCategory: IssueCategory.FEEDBACK,
      project,
    });

    render(
      <FeedbackApiOptions organization={organization}>
        <FeedbackActivitySection feedbackItem={feedbackItem} />
      </FeedbackApiOptions>,
      {organization}
    );

    expect(await screen.findByText('Marked as Spam')).toBeInTheDocument();
    expect(screen.queryByText('Archived')).not.toBeInTheDocument();
    expect(screen.queryByText(/forever/)).not.toBeInTheDocument();
  });
});
