import type {GroupOpenPeriod} from 'sentry/types/group';
import {
  makeIssueDetailsLocation,
  type IssueDetailsLocation,
} from 'sentry/views/issueDetails/issueDetailsQueryParams';

/**
 * Links to the open period's issue, at the event that opened it when known.
 */
export function getOpenPeriodIssueLocation(
  openPeriod: GroupOpenPeriod,
  organizationSlug: string,
  query?: Record<string, unknown>
): IssueDetailsLocation {
  const openingEventId = openPeriod.activities.find(
    activity => activity.type === 'opened'
  )?.eventId;

  return makeIssueDetailsLocation({
    organization: {slug: organizationSlug},
    groupId: openPeriod.groupId,
    eventId: openingEventId,
    query,
  });
}
