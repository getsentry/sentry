import {GroupActivityType, GroupStatus, type Group} from 'sentry/types/group';

const RESOLVED_ACTIVITY_TYPES = [
  GroupActivityType.SET_RESOLVED,
  GroupActivityType.SET_RESOLVED_BY_AGE,
  GroupActivityType.SET_RESOLVED_IN_RELEASE,
  GroupActivityType.SET_RESOLVED_IN_COMMIT,
];

/**
 * Returns the time (unix seconds) the group was most recently resolved
 */
export function getResolvedAt(group: Group): number | undefined {
  if (group.status !== GroupStatus.RESOLVED) {
    return undefined;
  }
  const resolvedActivity = group.activity.find(activity =>
    RESOLVED_ACTIVITY_TYPES.includes(activity.type)
  );
  if (!resolvedActivity) {
    return undefined;
  }
  const resolvedMs = new Date(resolvedActivity.dateCreated).getTime();
  return Number.isNaN(resolvedMs) ? undefined : resolvedMs / 1000;
}
