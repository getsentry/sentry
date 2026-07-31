import type {GroupActivity} from 'sentry/types/group';
import {GroupActivityType, SEER_ACTIVITY_TYPES} from 'sentry/types/group';

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
