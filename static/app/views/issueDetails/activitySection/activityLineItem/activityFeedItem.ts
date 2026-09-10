import type {GroupActivity} from 'sentry/types/group';
import {GroupActivityType, SEER_ACTIVITY_TYPES} from 'sentry/types/group';
import {deduplicatePullRequestActivities} from 'sentry/views/issueDetails/activitySection/activityLineItem/deduplicatePullRequestActivities';

type ActivityOfType<Type extends GroupActivityType> = Extract<
  GroupActivity,
  {type: Type}
>;

const SEER_ACTIVITY_PAIRS = {
  [GroupActivityType.SEER_RCA_COMPLETED]: GroupActivityType.SEER_RCA_STARTED,
  [GroupActivityType.SEER_SOLUTION_COMPLETED]: GroupActivityType.SEER_SOLUTION_STARTED,
  [GroupActivityType.SEER_CODING_COMPLETED]: GroupActivityType.SEER_CODING_STARTED,
  [GroupActivityType.SEER_ITERATION_COMPLETED]: GroupActivityType.SEER_ITERATION_STARTED,
} as const;

type SeerActivityPair = typeof SEER_ACTIVITY_PAIRS;
type CollapsedSeerActivityType = keyof typeof SEER_ACTIVITY_PAIRS;
type CollapsibleSeerCompletionActivity = ActivityOfType<CollapsedSeerActivityType>;

export type CollapsedSeerActivity = {
  [Type in CollapsedSeerActivityType]: {
    activity: ActivityOfType<Type>;
    startedActivity: ActivityOfType<SeerActivityPair[Type]>;
    type: Type;
  };
}[CollapsedSeerActivityType];

export type ActivityFeedItem =
  | {
      activity: GroupActivity;
      type: 'activity';
      actorActivity?: GroupActivity;
    }
  | CollapsedSeerActivity;

interface CollapsedStatusActivity {
  activities: ActivityFeedItem[];
  /** The first rolled-up item provides a stable key for the summary row. */
  activity: GroupActivity;
  type: 'collapsed_status_activities';
}

export type DisplayedActivityFeedItem = ActivityFeedItem | CollapsedStatusActivity;

const RESOLUTION_ACTIVITY_TYPES = new Set<GroupActivityType>([
  GroupActivityType.SET_RESOLVED,
  GroupActivityType.SET_RESOLVED_BY_AGE,
  GroupActivityType.SET_RESOLVED_IN_RELEASE,
  GroupActivityType.SET_RESOLVED_IN_COMMIT,
]);
// SET_RESOLVED_IN_PULL_REQUEST is intentionally absent: despite its backend name, it records
// that an issue was referenced in a pull request rather than a resolved status transition.

// These are the complete set of backend reasons for automatic priority changes. Priority
// activities without one of these reasons should remain visible boundaries.
const FLAPPING_PRIORITY_REASONS = new Set(['escalating', 'issue_platform', 'ongoing']);

function isResolutionActivity(activity: ActivityFeedItem): boolean {
  return RESOLUTION_ACTIVITY_TYPES.has(activity.activity.type);
}

function isFlappingStatusActivity(activity: ActivityFeedItem): boolean {
  if (isResolutionActivity(activity)) {
    return true;
  }

  const groupActivity = activity.activity;
  switch (groupActivity.type) {
    case GroupActivityType.SET_REGRESSION:
    case GroupActivityType.AUTO_SET_ONGOING:
    case GroupActivityType.SET_ESCALATING:
      return true;
    case GroupActivityType.SET_UNRESOLVED:
      // A user-authored reopen is meaningful history and splits automatic flapping runs.
      return !groupActivity.user;
    case GroupActivityType.SET_PRIORITY:
      return FLAPPING_PRIORITY_REASONS.has(groupActivity.data.reason);
    default:
      return false;
  }
}

/**
 * A run is only noise once it contains both sides of a resolve/regress flap. This keeps isolated
 * automatic lifecycle updates visible.
 */
function isCollapsibleStatusRun(run: ActivityFeedItem[]): boolean {
  return (
    run.some(item => item.activity.type === GroupActivityType.SET_REGRESSION) &&
    run.some(isResolutionActivity)
  );
}

function getSeerRunId(activity: GroupActivity): number | undefined {
  if (!('run_id' in activity.data)) {
    return undefined;
  }

  return typeof activity.data.run_id === 'number' ? activity.data.run_id : undefined;
}

function isCollapsibleSeerCompletionActivity(
  activity: GroupActivity
): activity is CollapsibleSeerCompletionActivity {
  return activity.type in SEER_ACTIVITY_PAIRS;
}

function collapseSeerActivityPair(
  completedActivity: CollapsibleSeerCompletionActivity,
  startedActivity: GroupActivity
): CollapsedSeerActivity | null {
  const completedRunId = getSeerRunId(completedActivity);
  if (completedRunId === undefined || completedRunId !== getSeerRunId(startedActivity)) {
    return null;
  }

  switch (completedActivity.type) {
    case GroupActivityType.SEER_RCA_COMPLETED:
      return startedActivity.type === GroupActivityType.SEER_RCA_STARTED
        ? {
            activity: completedActivity,
            startedActivity,
            type: completedActivity.type,
          }
        : null;
    case GroupActivityType.SEER_SOLUTION_COMPLETED:
      return startedActivity.type === GroupActivityType.SEER_SOLUTION_STARTED
        ? {
            activity: completedActivity,
            startedActivity,
            type: completedActivity.type,
          }
        : null;
    case GroupActivityType.SEER_CODING_COMPLETED:
      return startedActivity.type === GroupActivityType.SEER_CODING_STARTED
        ? {
            activity: completedActivity,
            startedActivity,
            type: completedActivity.type,
          }
        : null;
    case GroupActivityType.SEER_ITERATION_COMPLETED:
      return startedActivity.type === GroupActivityType.SEER_ITERATION_STARTED
        ? {
            activity: completedActivity,
            startedActivity,
            type: completedActivity.type,
          }
        : null;
  }

  return null;
}

function findCollapsedSeerActivity(
  activities: GroupActivity[],
  completedActivity: CollapsibleSeerCompletionActivity,
  completedActivityIndex: number
): {activity: CollapsedSeerActivity; startedActivityIndex: number} | null {
  for (let index = completedActivityIndex + 1; index < activities.length; index += 1) {
    const activity = activities[index];
    if (!activity || !SEER_ACTIVITY_TYPES.has(activity.type)) {
      continue;
    }

    const collapsedActivity = collapseSeerActivityPair(completedActivity, activity);
    return collapsedActivity
      ? {activity: collapsedActivity, startedActivityIndex: index}
      : null;
  }

  return null;
}

/**
 * Issue activity is ordered newest first. Collapse a completed Seer activity with the next
 * Seer activity when it is the corresponding start event, allowing unrelated activity to
 * remain between them. Keep the completed activity as the representative item so its marker,
 * timestamp, and result details are preserved.
 */
export function collapseSeerActivityPairs(
  activities: GroupActivity[]
): ActivityFeedItem[] {
  const collapsedActivities: ActivityFeedItem[] = [];
  const collapsedStartedActivityIndexes = new Set<number>();

  for (let index = 0; index < activities.length; index += 1) {
    if (collapsedStartedActivityIndexes.has(index)) {
      continue;
    }

    const activity = activities[index];
    if (!activity) {
      break;
    }

    const collapsedActivity = isCollapsibleSeerCompletionActivity(activity)
      ? findCollapsedSeerActivity(activities, activity, index)
      : null;

    if (collapsedActivity) {
      collapsedActivities.push(collapsedActivity.activity);
      collapsedStartedActivityIndexes.add(collapsedActivity.startedActivityIndex);
    } else {
      collapsedActivities.push({type: 'activity', activity});
    }
  }

  return collapsedActivities;
}

/**
 * - Keep the newest adjacent regression/resolution pair and everything newer visible.
 * - Treat unrelated or user-authored activity as a boundary between runs.
 * - Collapse each remaining consecutive run only when it contains both a resolution and a
 *   regression; keep incomplete runs visible.
 * - Match loosely by activity type and feed order because these events have no shared identifier.
 */
export function collapseFlappingStatusActivities(
  activities: ActivityFeedItem[]
): DisplayedActivityFeedItem[] {
  const latestPairIndex = activities.findIndex((activity, index) => {
    const nextActivity = activities[index + 1];
    return (
      activity.activity.type === GroupActivityType.SET_REGRESSION &&
      nextActivity !== undefined &&
      isResolutionActivity(nextActivity)
    );
  });

  // Preserve everything through the newest pair; +2 includes both the regression and resolution.
  const protectedActivityCount = latestPairIndex === -1 ? 0 : latestPairIndex + 2;
  const displayedActivities: DisplayedActivityFeedItem[] = activities.slice(
    0,
    protectedActivityCount
  );

  for (let index = protectedActivityCount; index < activities.length;) {
    const activity = activities[index];
    if (!activity) {
      break;
    }

    if (!isFlappingStatusActivity(activity)) {
      displayedActivities.push(activity);
      index += 1;
      continue;
    }

    const run: [ActivityFeedItem, ...ActivityFeedItem[]] = [activity];
    index += 1;
    while (index < activities.length) {
      const runActivity = activities[index];
      if (!runActivity || !isFlappingStatusActivity(runActivity)) {
        break;
      }
      run.push(runActivity);
      index += 1;
    }

    if (isCollapsibleStatusRun(run)) {
      displayedActivities.push({
        type: 'collapsed_status_activities',
        activity: run[0].activity,
        activities: run,
      });
    } else {
      displayedActivities.push(...run);
    }
  }

  return displayedActivities;
}

interface BuildActivityFeedItemsOptions {
  activities: GroupActivity[];
  filterComments?: boolean;
}

export function buildActivityFeedItems({
  activities,
  filterComments,
}: BuildActivityFeedItemsOptions): DisplayedActivityFeedItem[] {
  const {activities: deduplicatedActivities, actorActivityById} =
    deduplicatePullRequestActivities(activities);
  const filteredActivities = deduplicatedActivities.filter(
    item => !filterComments || item.type === GroupActivityType.NOTE
  );
  const activityFeedItems = collapseSeerActivityPairs(filteredActivities).map(item => {
    const actorActivity = actorActivityById.get(item.activity.id);
    return item.type === 'activity' && actorActivity ? {...item, actorActivity} : item;
  });

  // Collapse status flapping last so expanding a rollup restores the fully processed feed items.
  return collapseFlappingStatusActivities(activityFeedItems);
}
