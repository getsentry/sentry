import type {GroupOpenPeriod} from 'sentry/types/group';

/**
 * Links to the open period's issue, at the event that opened it when known.
 */
export function getOpenPeriodIssuePath(
  openPeriod: GroupOpenPeriod,
  organizationSlug: string
): string {
  const issuePath = `/organizations/${organizationSlug}/issues/${openPeriod.groupId}/`;

  const openingEventId = openPeriod.activities.find(
    activity => activity.type === 'opened'
  )?.eventId;

  return openingEventId ? `${issuePath}events/${openingEventId}/` : issuePath;
}
