import {ActivityFeedFixture} from 'sentry-fixture/activityFeed';
import {GroupFixture} from 'sentry-fixture/group';

import {act, render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {Text} from '@sentry/scraps/text';

import {GroupActivityType} from 'sentry/types/group';

import {buildActivityFeedItems} from './activityLineItem/activityFeedItem';
import {ActivityFeed} from './activityFeed';

describe('ActivityFeed composition', () => {
  const completed = ActivityFeedFixture({
    id: 'completed',
    type: GroupActivityType.SEER_RCA_COMPLETED,
    data: {run_id: 42},
  });
  const started = ActivityFeedFixture({
    id: 'started',
    type: GroupActivityType.SEER_RCA_STARTED,
    data: {run_id: 42},
  });
  const group = GroupFixture({activity: [completed, started]});

  it('preserves the default headline-only feed', () => {
    render(
      <ActivityFeed
        group={group}
        items={buildActivityFeedItems({activities: group.activity})}
        inputVariant="full"
        onCommentDelete={jest.fn()}
        onCommentUpdate={jest.fn()}
      />
    );

    expect(screen.getByText('Root cause found')).toBeVisible();
    expect(screen.queryByText('Root cause analysis started')).not.toBeInTheDocument();
  });

  it('renders content once under the representative paired activity', () => {
    const bodyByActivityId = new Map<string, React.ReactNode>([
      [completed.id, <Text key="completed">Result for completed</Text>],
      [started.id, <Text key="started">Result for started</Text>],
    ]);
    render(
      <ActivityFeed
        group={group}
        items={buildActivityFeedItems({activities: group.activity})}
        bodyByActivityId={bodyByActivityId}
        inputVariant="full"
        onCommentDelete={jest.fn()}
        onCommentUpdate={jest.fn()}
      />
    );

    expect(screen.getByText('Root cause found')).toBeVisible();
    expect(screen.getByText('Result for completed')).toBeVisible();
    expect(screen.queryByText('Result for started')).not.toBeInTheDocument();
  });

  it('supports content for arbitrary activities inside an expanded status rollup', async () => {
    const activities = [
      ActivityFeedFixture({
        id: 'regression',
        type: GroupActivityType.SET_REGRESSION,
        data: {},
      }),
      ActivityFeedFixture({
        id: 'ongoing',
        type: GroupActivityType.AUTO_SET_ONGOING,
        data: {},
      }),
      ActivityFeedFixture({
        id: 'resolved',
        type: GroupActivityType.SET_RESOLVED,
        data: {},
      }),
    ];
    const bodyByActivityId = new Map<string, React.ReactNode>(
      activities.map(activity => [
        activity.id,
        <Text key={activity.id}>Result for {activity.id}</Text>,
      ])
    );
    render(
      <ActivityFeed
        group={group}
        items={buildActivityFeedItems({activities})}
        bodyByActivityId={bodyByActivityId}
        inputVariant="full"
        onCommentDelete={jest.fn()}
        onCommentUpdate={jest.fn()}
      />
    );

    expect(screen.queryByText('Result for resolved')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name: 'Show 3 more'}));
    expect(screen.getByText('Result for resolved')).toBeVisible();
    await userEvent.click(screen.getByRole('button', {name: 'Hide 3 events'}));
    expect(screen.queryByText('Result for resolved')).not.toBeInTheDocument();
  });

  it('renders comments alongside cards while preserving editing', async () => {
    const note = ActivityFeedFixture({id: 'note', data: {text: 'An existing comment'}});
    const onCommentUpdate = jest.fn().mockResolvedValue(undefined);
    render(
      <ActivityFeed
        group={group}
        items={buildActivityFeedItems({activities: [note, completed]})}
        bodyByActivityId={
          new Map<string, React.ReactNode>([
            [completed.id, <Text key="completed">Analysis result</Text>],
          ])
        }
        inputVariant="full"
        onCommentDelete={jest.fn()}
        onCommentUpdate={onCommentUpdate}
      />
    );

    expect(screen.getByText('An existing comment')).toBeVisible();
    expect(screen.getByText('Analysis result')).toBeVisible();
    await userEvent.click(screen.getByRole('button', {name: 'Comment Actions'}));
    await userEvent.click(screen.getByRole('menuitemradio', {name: 'Edit'}));
    const editor = screen.getByRole('combobox');
    editor.setAttribute('contenteditable', 'true');
    await userEvent.clear(editor);
    await userEvent.type(editor, 'Updated comment');
    await userEvent.click(screen.getByRole('button', {name: 'Save comment'}));
    expect(onCommentUpdate).toHaveBeenCalledWith(
      note,
      expect.objectContaining({text: 'Updated comment'})
    );
  });

  it('preserves a comment draft when neighboring card content changes', async () => {
    const note = ActivityFeedFixture({id: 'note', data: {text: 'An existing comment'}});
    const onCommentDelete = jest.fn();
    const onCommentUpdate = jest.fn();
    const {rerender} = render(
      <ActivityFeed
        group={group}
        items={buildActivityFeedItems({activities: [note, completed]})}
        inputVariant="full"
        onCommentDelete={onCommentDelete}
        onCommentUpdate={onCommentUpdate}
      />
    );

    await userEvent.click(screen.getByRole('button', {name: 'Comment Actions'}));
    await userEvent.click(screen.getByRole('menuitemradio', {name: 'Edit'}));
    const editor = screen.getByRole('combobox');
    editor.setAttribute('contenteditable', 'true');
    await userEvent.clear(editor);
    await userEvent.type(editor, 'My unfinished edit');

    rerender(
      <ActivityFeed
        group={group}
        items={buildActivityFeedItems({activities: [note, completed]})}
        bodyByActivityId={
          new Map<string, React.ReactNode>([
            [completed.id, <Text key="completed">Updated result</Text>],
          ])
        }
        inputVariant="full"
        onCommentDelete={onCommentDelete}
        onCommentUpdate={onCommentUpdate}
      />
    );

    expect(screen.getByText('Updated result')).toBeVisible();
    expect(screen.getByRole('combobox')).toHaveTextContent('My unfinished edit');
    expect(onCommentUpdate).not.toHaveBeenCalled();
  });

  it('preserves a pending comment save when a neighboring card arrives', async () => {
    const note = ActivityFeedFixture({id: 'note', data: {text: 'An existing comment'}});
    const pendingUpdate = Promise.withResolvers<void>();
    const onCommentUpdate = jest.fn(() => pendingUpdate.promise);
    const onCommentDelete = jest.fn();
    const items = buildActivityFeedItems({activities: [note, completed]});
    const {rerender} = render(
      <ActivityFeed
        group={group}
        items={items}
        inputVariant="full"
        onCommentDelete={onCommentDelete}
        onCommentUpdate={onCommentUpdate}
      />
    );

    await userEvent.click(screen.getByRole('button', {name: 'Comment Actions'}));
    await userEvent.click(screen.getByRole('menuitemradio', {name: 'Edit'}));
    const editor = screen.getByRole('combobox', {name: 'Edit comment'});
    editor.setAttribute('contenteditable', 'true');
    await userEvent.clear(editor);
    await userEvent.type(editor, 'An update in progress');
    await userEvent.click(screen.getByRole('button', {name: 'Save comment'}));

    rerender(
      <ActivityFeed
        group={group}
        items={buildActivityFeedItems({activities: [note, completed]})}
        bodyByActivityId={
          new Map([[completed.id, <Text key="result">New analysis result</Text>]])
        }
        inputVariant="full"
        onCommentDelete={onCommentDelete}
        onCommentUpdate={onCommentUpdate}
      />
    );

    expect(screen.getByText('New analysis result')).toBeVisible();
    expect(screen.getByRole('combobox', {name: 'Edit comment'})).toHaveTextContent(
      'An update in progress'
    );
    expect(screen.getByRole('button', {name: 'Cancel'})).toBeDisabled();
    expect(onCommentUpdate).toHaveBeenCalledTimes(1);
    expect(onCommentUpdate).toHaveBeenCalledWith(
      note,
      expect.objectContaining({text: 'An update in progress'})
    );

    await act(async () => pendingUpdate.resolve());
    await waitFor(() =>
      expect(
        screen.queryByRole('combobox', {name: 'Edit comment'})
      ).not.toBeInTheDocument()
    );
  });
});
