import type {GroupOpenPeriod} from 'sentry/types/group';

export interface IssueOpenPeriods {
  groupId: string;
  /**
   * Newest first
   */
  openPeriods: [GroupOpenPeriod, ...GroupOpenPeriod[]];
  shortId: string | null;
}

/**
 * Groups newest-first open periods by their issue, keeping issues in the order of their newest open period.
 */
export function groupOpenPeriodsByIssue(
  openPeriods: GroupOpenPeriod[]
): IssueOpenPeriods[] {
  const issuesByGroupId = new Map<string, IssueOpenPeriods>();

  for (const openPeriod of openPeriods) {
    const issue = issuesByGroupId.get(openPeriod.groupId);

    if (issue) {
      issue.openPeriods.push(openPeriod);

      continue;
    }

    issuesByGroupId.set(openPeriod.groupId, {
      groupId: openPeriod.groupId,
      shortId: openPeriod.shortId,
      openPeriods: [openPeriod],
    });
  }

  return Array.from(issuesByGroupId.values());
}
