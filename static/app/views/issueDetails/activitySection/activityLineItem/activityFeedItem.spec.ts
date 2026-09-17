import {ActivityFeedFixture} from 'sentry-fixture/activityFeed';
import {UserFixture} from 'sentry-fixture/user';

import {GroupActivityType, PriorityLevel} from 'sentry/types/group';

import {
  type ActivityFeedItem,
  collapseFlappingStatusActivities,
  type DisplayedActivityFeedItem,
} from './activityFeedItem';

type ActivityFixtureParams = NonNullable<Parameters<typeof ActivityFeedFixture>[0]>;

function activity(params: ActivityFixtureParams): ActivityFeedItem {
  return {
    type: 'activity',
    activity: {...ActivityFeedFixture(params), user: params.user ?? null},
  };
}

function regression(): ActivityFeedItem {
  return activity({type: GroupActivityType.SET_REGRESSION, data: {}});
}

function resolved(): ActivityFeedItem {
  return activity({type: GroupActivityType.SET_RESOLVED, data: {}});
}

function ongoing(): ActivityFeedItem {
  return activity({
    type: GroupActivityType.AUTO_SET_ONGOING,
    data: {after_days: 7},
  });
}

function resolvedByAge(): ActivityFeedItem {
  return activity({type: GroupActivityType.SET_RESOLVED_BY_AGE, data: {age: 7}});
}

function expectCollapsedActivities(
  item: DisplayedActivityFeedItem | undefined,
  expectedActivities: ActivityFeedItem[]
) {
  expect(item).toMatchObject({
    type: 'collapsed_status_activities',
    activities: expectedActivities,
  });
}

describe('collapseFlappingStatusActivities', () => {
  it('keeps the newest pair visible and merges adjacent older pairs into one rollup', () => {
    const newestRegression = regression();
    const newestResolution = resolved();
    const olderRun = [
      activity({
        type: GroupActivityType.SET_PRIORITY,
        data: {priority: PriorityLevel.HIGH, reason: 'issue_platform'},
      }),
      regression(),
      resolved(),
      ongoing(),
      regression(),
      resolved(),
    ];
    const result = collapseFlappingStatusActivities([
      newestRegression,
      newestResolution,
      ...olderRun,
    ]);

    expect(result.slice(0, 2)).toEqual([newestRegression, newestResolution]);
    expect(result).toHaveLength(3);
    expectCollapsedActivities(result[2], olderRun);
  });

  it('keeps the newest pair visible when newer user activity exists', () => {
    const manualReopen = activity({
      type: GroupActivityType.SET_UNRESOLVED,
      data: {},
      user: UserFixture(),
    });
    const newestRun = [ongoing(), regression(), resolvedByAge()];
    const olderRun = [ongoing(), regression(), resolvedByAge()];
    const result = collapseFlappingStatusActivities([
      manualReopen,
      ...newestRun,
      ...olderRun,
    ]);

    expect(result.slice(0, 4)).toEqual([manualReopen, ...newestRun]);
    expect(result).toHaveLength(5);
    expectCollapsedActivities(result[4], olderRun);
  });

  it('recognizes a resolved status transition', () => {
    const newestPair = [regression(), resolved()];
    const flappingPair = [
      regression(),
      activity({
        type: GroupActivityType.SET_RESOLVED_IN_RELEASE,
        data: {version: '1.0.0'},
      }),
    ];
    const result = collapseFlappingStatusActivities([...newestPair, ...flappingPair]);

    expectCollapsedActivities(result[2], flappingPair);
  });

  it('absorbs automatic lifecycle and priority activity into a flapping run', () => {
    const automaticRun = [
      resolved(),
      activity({type: GroupActivityType.SET_UNRESOLVED, data: {}}),
      activity({
        type: GroupActivityType.SET_PRIORITY,
        data: {priority: PriorityLevel.HIGH, reason: 'issue_platform'},
      }),
      ongoing(),
      activity({
        type: GroupActivityType.SET_PRIORITY,
        data: {priority: PriorityLevel.MEDIUM, reason: 'ongoing'},
      }),
      activity({type: GroupActivityType.SET_ESCALATING, data: {}}),
      activity({
        type: GroupActivityType.SET_PRIORITY,
        data: {priority: PriorityLevel.HIGH, reason: 'escalating'},
      }),
      regression(),
    ];
    const result = collapseFlappingStatusActivities([
      activity({
        type: GroupActivityType.SET_UNRESOLVED,
        data: {},
        user: UserFixture(),
      }),
      ...automaticRun,
    ]);

    expectCollapsedActivities(result[1], automaticRun);
  });

  it('does not hide an incomplete automatic run', () => {
    const activities = [
      resolved(),
      ongoing(),
      activity({
        type: GroupActivityType.SET_PRIORITY,
        data: {priority: PriorityLevel.MEDIUM, reason: 'ongoing'},
      }),
    ];

    expect(collapseFlappingStatusActivities(activities)).toEqual(activities);
  });

  it('keeps other priority activity as a boundary before an older rollup', () => {
    const manualReopen = activity({
      type: GroupActivityType.SET_UNRESOLVED,
      data: {},
      user: UserFixture(),
    });
    const otherPriority = activity({
      type: GroupActivityType.SET_PRIORITY,
      data: {priority: PriorityLevel.LOW, reason: 'other'},
    });
    const newerRun = [regression(), resolved()];
    const olderRun = [regression(), resolved()];
    const result = collapseFlappingStatusActivities([
      manualReopen,
      ...newerRun,
      otherPriority,
      ...olderRun,
    ]);

    expect(result.slice(0, 3)).toEqual([manualReopen, ...newerRun]);
    expect(result).toHaveLength(5);
    expect(result[3]).toBe(otherPriority);
    expectCollapsedActivities(result[4], olderRun);
  });
});
