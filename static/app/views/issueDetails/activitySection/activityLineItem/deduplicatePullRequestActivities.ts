import type {GroupActivity} from 'sentry/types/group';
import {GroupActivityType} from 'sentry/types/group';

function isDuplicateCommitActivity(
  activity: GroupActivity,
  adjacentActivity: GroupActivity | undefined
): boolean {
  if (
    activity.type !== GroupActivityType.REFERENCED_IN_COMMIT ||
    adjacentActivity?.type !== GroupActivityType.PULL_REQUEST_MERGED
  ) {
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

function getPullRequestUrls(activity: GroupActivity): string[] {
  switch (activity.type) {
    case GroupActivityType.SET_RESOLVED_IN_PULL_REQUEST:
      return activity.data.pullRequest?.externalUrl
        ? [activity.data.pullRequest.externalUrl]
        : [];
    case GroupActivityType.SEER_PR_CREATED:
    case GroupActivityType.SEER_PR_READY_FOR_REVIEW:
      return (
        activity.data.pull_requests?.map(pr => pr.pull_request.pr_url).filter(Boolean) ??
        []
      );
    default:
      return [];
  }
}

function findAdjacentReference(
  activity: GroupActivity,
  index: number,
  activities: GroupActivity[]
): GroupActivity | undefined {
  const urls = getPullRequestUrls(activity);
  const otherSeerType =
    activity.type === GroupActivityType.SEER_PR_CREATED
      ? GroupActivityType.SEER_PR_READY_FOR_REVIEW
      : GroupActivityType.SEER_PR_CREATED;

  for (const direction of [-1, 1]) {
    const adjacent = activities[index + direction];
    const reference =
      adjacent?.type === otherSeerType ? activities[index + direction * 2] : adjacent;
    if (reference?.type !== GroupActivityType.SET_RESOLVED_IN_PULL_REQUEST) {
      continue;
    }
    const url = reference.data.pullRequest?.externalUrl;
    if (
      url &&
      urls.includes(url) &&
      (adjacent === reference || (adjacent && getPullRequestUrls(adjacent).includes(url)))
    ) {
      return reference;
    }
  }
  return undefined;
}

/** Keep reference rows and creation attribution, allowing a matching Seer PR milestone between them. */
export function deduplicatePullRequestActivities(activities: GroupActivity[]): {
  activities: GroupActivity[];
  actorActivityById: Map<string, GroupActivity>;
} {
  const actorActivityById = new Map<string, GroupActivity>();
  const filteredActivities = activities.filter((activity, index) => {
    const adjacentActivities = [activities[index - 1], activities[index + 1]];
    if (
      adjacentActivities.some(adjacent => isDuplicateCommitActivity(activity, adjacent))
    ) {
      return false;
    }
    if (
      activity.type !== GroupActivityType.SEER_PR_CREATED &&
      activity.type !== GroupActivityType.SEER_PR_READY_FOR_REVIEW
    ) {
      return true;
    }

    const reference = findAdjacentReference(activity, index, activities);
    if (reference) {
      // Creation carries the actor and run used to attach coding results.
      if (
        activity.type === GroupActivityType.SEER_PR_CREATED ||
        !actorActivityById.has(reference.id)
      ) {
        actorActivityById.set(reference.id, activity);
      }
      return false;
    }

    const urls = getPullRequestUrls(activity);
    return (
      activity.type !== GroupActivityType.SEER_PR_READY_FOR_REVIEW ||
      !adjacentActivities.some(
        adjacent =>
          adjacent?.type === GroupActivityType.SEER_PR_CREATED &&
          getPullRequestUrls(adjacent).some(url => urls.includes(url))
      )
    );
  });

  return {activities: filteredActivities, actorActivityById};
}
