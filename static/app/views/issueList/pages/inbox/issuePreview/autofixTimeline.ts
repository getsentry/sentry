import type {AutofixSection} from 'sentry/components/events/autofix/useExplorerAutofix';
import {
  GroupActivityType,
  SEER_ACTIVITY_TYPES,
  type GroupActivity,
} from 'sentry/types/group';
import {
  buildActivityFeedItems,
  type DisplayedActivityFeedItem,
} from 'sentry/views/issueDetails/activitySection/activityLineItem/activityFeedItem';

const STEP_ACTIVITIES: Record<
  string,
  {completed: GroupActivityType[]; processing: GroupActivityType}
> = {
  root_cause: {
    processing: GroupActivityType.SEER_RCA_STARTED,
    completed: [GroupActivityType.SEER_RCA_COMPLETED],
  },
  solution: {
    processing: GroupActivityType.SEER_SOLUTION_STARTED,
    completed: [GroupActivityType.SEER_SOLUTION_COMPLETED],
  },
  code_changes: {
    processing: GroupActivityType.SEER_CODING_STARTED,
    completed: [
      GroupActivityType.SEER_CODING_COMPLETED,
      GroupActivityType.SEER_PR_CREATED,
    ],
  },
  pr_iteration: {
    processing: GroupActivityType.SEER_ITERATION_STARTED,
    completed: [GroupActivityType.SEER_ITERATION_COMPLETED],
  },
};

type AutofixTimelineItem = DisplayedActivityFeedItem & {section?: AutofixSection};

/** Match current results to newest-first activity; the API doesn't link them directly. */
export function getAutofixTimelineItems(
  activities: GroupActivity[],
  runId: number | undefined,
  sections: AutofixSection[]
): AutofixTimelineItem[] {
  const matches = sections.map(section => ({
    activity: runId ? findSectionActivity(activities, runId, section) : undefined,
    section,
  }));

  return buildActivityFeedItems({activities}).map(item => {
    const activity =
      item.type === 'activity' ? (item.actorActivity ?? item.activity) : item.activity;
    const match = matches.find(candidate => candidate.activity?.id === activity.id);
    return match ? {...item, section: match.section} : item;
  });
}

function findSectionActivity(
  activities: GroupActivity[],
  runId: number,
  section: AutofixSection
): GroupActivity | undefined {
  // Code changes include subsequent PR iterations, so use their latest step.
  const step =
    section.blocks.findLast(block => block.message.metadata?.step)?.message.metadata
      ?.step ?? section.step;
  const types = Object.hasOwn(STEP_ACTIVITIES, step) ? STEP_ACTIVITIES[step] : undefined;
  if (section.status === 'error' || !types) {
    return undefined;
  }

  const activityIndex = activities.findIndex((item, index) => {
    if (item.type !== types.processing && !types.completed.includes(item.type)) {
      return false;
    }

    let runActivity = item;
    if (!('run_id' in item.data)) {
      // Some completions omit the run ID; only trust an adjacent Seer start.
      const started = activities
        .slice(index + 1)
        .find(candidate => SEER_ACTIVITY_TYPES.has(candidate.type));
      if (!types.completed.includes(item.type) || started?.type !== types.processing) {
        return false;
      }
      runActivity = started;
    }

    // Older RCA events can contain string run IDs.
    return (
      'run_id' in runActivity.data && String(runActivity.data.run_id) === String(runId)
    );
  });
  const activity = activities[activityIndex];
  if (
    !activity ||
    (section.status === 'completed'
      ? !types.completed.includes(activity.type)
      : activity.type !== types.processing)
  ) {
    return undefined;
  }

  // A retry's activity and run state can arrive in either order.
  const previousLifecycle =
    activity.type === types.processing
      ? activity
      : activities
          .slice(activityIndex + 1)
          .find(
            item =>
              (item.type === types.processing || item.type === activity.type) &&
              'run_id' in item.data &&
              String(item.data.run_id) === String(runId)
          );
  const lowerBound = previousLifecycle
    ? Date.parse(previousLifecycle.dateCreated)
    : -Infinity;
  const blockTimes = section.blocks.map(block => Date.parse(block.timestamp));
  if (
    Number.isNaN(lowerBound) ||
    blockTimes.some(Number.isNaN) ||
    blockTimes.every(time => time <= lowerBound)
  ) {
    return undefined;
  }
  if (section.status === 'completed') {
    const completedAt = Date.parse(activity.dateCreated);
    if (Number.isNaN(completedAt) || blockTimes.some(time => time > completedAt)) {
      return undefined;
    }
  }

  return activity;
}
