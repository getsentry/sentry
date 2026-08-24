import {GroupFixture} from 'sentry-fixture/group';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import type {GroupActivity} from 'sentry/types/group';
import {GroupActivityType} from 'sentry/types/group';
import {ProgressActivityTooltip} from 'sentry/views/issueList/progressActivityTooltip';

describe('ProgressActivityTooltip', () => {
  const group = GroupFixture({id: '1337'});
  const activity: GroupActivity = {
    id: 'activity-1',
    type: GroupActivityType.SET_UNRESOLVED,
    data: {},
    dateCreated: '2024-01-01T00:00:00.000Z',
    user: null,
  };

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/1337/activities/',
      body: {activity: [activity]},
    });
  });

  it('shows progress activity in a hovercard', async () => {
    render(
      <ProgressActivityTooltip group={group}>
        <button>Progress</button>
      </ProgressActivityTooltip>
    );

    expect(screen.getByRole('button', {name: 'Progress'})).toHaveStyle({
      textDecoration: 'underline',
    });

    await userEvent.hover(screen.getByRole('button', {name: 'Progress'}));

    expect(await screen.findByText('Marked as unresolved')).toBeInTheDocument();
  });

  it('filters out non-progress activity', async () => {
    const mergeActivity: GroupActivity = {
      id: 'activity-2',
      type: GroupActivityType.MERGE,
      data: {issues: [{id: '99'}]},
      dateCreated: '2024-01-02T00:00:00.000Z',
      user: null,
    };

    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/1337/activities/',
      body: {activity: [mergeActivity, activity]},
    });

    render(
      <ProgressActivityTooltip group={group}>
        <button>Progress</button>
      </ProgressActivityTooltip>
    );

    await userEvent.hover(screen.getByRole('button', {name: 'Progress'}));

    expect(await screen.findByText('Marked as unresolved')).toBeInTheDocument();
    expect(screen.queryByText(/Merge/)).not.toBeInTheDocument();
  });

  it('falls back to recent activities when none match progress types', async () => {
    const mergeActivity: GroupActivity = {
      id: 'activity-3',
      type: GroupActivityType.MERGE,
      data: {issues: [{id: '99'}]},
      dateCreated: '2024-01-03T00:00:00.000Z',
      user: null,
    };

    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/1337/activities/',
      body: {activity: [mergeActivity]},
    });

    render(
      <ProgressActivityTooltip group={group}>
        <button>Progress</button>
      </ProgressActivityTooltip>
    );

    await userEvent.hover(screen.getByRole('button', {name: 'Progress'}));

    expect(await screen.findByText(/Merge/)).toBeInTheDocument();
  });

  it('shows comment text', async () => {
    const noteActivity: GroupActivity = {
      id: 'activity-4',
      type: GroupActivityType.NOTE,
      data: {text: 'This is the useful part of the comment.'},
      dateCreated: '2024-01-04T00:00:00.000Z',
      user: null,
    };

    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/1337/activities/',
      body: {activity: [noteActivity]},
    });

    render(
      <ProgressActivityTooltip group={group}>
        <button>Progress</button>
      </ProgressActivityTooltip>
    );

    await userEvent.hover(screen.getByRole('button', {name: 'Progress'}));

    expect(
      await screen.findByText('This is the useful part of the comment.')
    ).toBeInTheDocument();
    expect(screen.getByText('Sentry')).toBeInTheDocument();
  });
});
