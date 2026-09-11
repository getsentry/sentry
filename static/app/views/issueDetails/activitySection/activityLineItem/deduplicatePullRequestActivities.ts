import type {GroupActivity} from 'sentry/types/group';
import {GroupActivityType} from 'sentry/types/group';

function isDuplicatePullRequestActivity(
  activity: GroupActivity,
  adjacentActivity: GroupActivity | undefined
): boolean {
  switch (activity.type) {
    case GroupActivityType.REFERENCED_IN_COMMIT: {
      if (adjacentActivity?.type !== GroupActivityType.PULL_REQUEST_MERGED) {
        return false;
      }

      const pullRequest = activity.data.commit?.pullRequest;
      const adjacentPullRequest = adjacentActivity.data.pullRequest;
      if (!pullRequest || !adjacentPullRequest) {
        return false;
      }

      return (
        pullRequest.id === adjacentPullRequest.id &&
        pullRequest.repository.id === adjacentPullRequest.repository.id
      );
    }
    case GroupActivityType.SEER_PR_CREATED: {
      if (adjacentActivity?.type !== GroupActivityType.SET_RESOLVED_IN_PULL_REQUEST) {
        return false;
      }

      const adjacentPullRequest = adjacentActivity.data.pullRequest;
      if (!adjacentPullRequest) {
        return false;
      }

      return Boolean(
        activity.data.pull_requests?.some(
          pullRequest =>
            pullRequest.pull_request.pr_url === adjacentPullRequest.externalUrl
        )
      );
    }
    default:
      return false;
  }
}

/**
 * Removes redundant pull request activity while preserving a removed Seer event as the actor
 * for the pull request activity that remains.
 */
export function deduplicatePullRequestActivities(activities: GroupActivity[]): {
  activities: GroupActivity[];
  actorActivityById: Map<string, GroupActivity>;
} {
  const actorActivityById = new Map<string, GroupActivity>();
  const filteredActivities = activities.filter((activity, index) => {
    const duplicateActivity = [activities[index - 1], activities[index + 1]].find(
      adjacentActivity => isDuplicatePullRequestActivity(activity, adjacentActivity)
    );

    if (activity.type === GroupActivityType.SEER_PR_CREATED && duplicateActivity) {
      actorActivityById.set(duplicateActivity.id, activity);
    }

    return !duplicateActivity;
  });

  return {activities: filteredActivities, actorActivityById};
}
