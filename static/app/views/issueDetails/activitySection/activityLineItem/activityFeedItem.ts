import type {GroupActivity} from 'sentry/types/group';
import {GroupActivityType, SEER_ACTIVITY_TYPES} from 'sentry/types/group';

type ActivityOfType<Type extends GroupActivityType> = Extract<
  GroupActivity,
  {type: Type}
>;

type CollapsibleSeerCompletionActivity = ActivityOfType<
  | GroupActivityType.SEER_RCA_COMPLETED
  | GroupActivityType.SEER_SOLUTION_COMPLETED
  | GroupActivityType.SEER_CODING_COMPLETED
  | GroupActivityType.SEER_ITERATION_COMPLETED
>;

export type CollapsedSeerActivity =
  | {
      activity: ActivityOfType<GroupActivityType.SEER_RCA_COMPLETED>;
      kind: 'collapsed-seer';
      phase: 'root-cause';
      startedActivity: ActivityOfType<GroupActivityType.SEER_RCA_STARTED>;
    }
  | {
      activity: ActivityOfType<GroupActivityType.SEER_SOLUTION_COMPLETED>;
      kind: 'collapsed-seer';
      phase: 'planning';
      startedActivity: ActivityOfType<GroupActivityType.SEER_SOLUTION_STARTED>;
    }
  | {
      activity: ActivityOfType<GroupActivityType.SEER_CODING_COMPLETED>;
      kind: 'collapsed-seer';
      phase: 'coding';
      startedActivity: ActivityOfType<GroupActivityType.SEER_CODING_STARTED>;
    }
  | {
      activity: ActivityOfType<GroupActivityType.SEER_ITERATION_COMPLETED>;
      kind: 'collapsed-seer';
      phase: 'iteration';
      startedActivity: ActivityOfType<GroupActivityType.SEER_ITERATION_STARTED>;
    };

export type ActivityFeedItem =
  | {
      activity: GroupActivity;
      kind: 'activity';
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
  return (
    activity.type === GroupActivityType.SEER_RCA_COMPLETED ||
    activity.type === GroupActivityType.SEER_SOLUTION_COMPLETED ||
    activity.type === GroupActivityType.SEER_CODING_COMPLETED ||
    activity.type === GroupActivityType.SEER_ITERATION_COMPLETED
  );
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
            kind: 'collapsed-seer',
            phase: 'root-cause',
            activity: completedActivity,
            startedActivity,
          }
        : null;
    case GroupActivityType.SEER_SOLUTION_COMPLETED:
      return startedActivity.type === GroupActivityType.SEER_SOLUTION_STARTED
        ? {
            kind: 'collapsed-seer',
            phase: 'planning',
            activity: completedActivity,
            startedActivity,
          }
        : null;
    case GroupActivityType.SEER_CODING_COMPLETED:
      return startedActivity.type === GroupActivityType.SEER_CODING_STARTED
        ? {
            kind: 'collapsed-seer',
            phase: 'coding',
            activity: completedActivity,
            startedActivity,
          }
        : null;
    case GroupActivityType.SEER_ITERATION_COMPLETED:
      return startedActivity.type === GroupActivityType.SEER_ITERATION_STARTED
        ? {
            kind: 'collapsed-seer',
            phase: 'iteration',
            activity: completedActivity,
            startedActivity,
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
 * actor, timestamp, and result details are preserved.
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
      collapsedActivities.push({kind: 'activity', activity});
    }
  }

  return collapsedActivities;
}
