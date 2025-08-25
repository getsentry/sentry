import {useMemo} from 'react';

import type {Group} from 'sentry/types/group';

import {getSeenIssueIds} from './seenIssuesStorage';

/**
 * Hook to filter issues based on whether they've been seen by the user
 */
export function useSeenIssuesFilter(issues: Group[]) {
  const seenIssueIds = useMemo(() => {
    return new Set(getSeenIssueIds());
  }, []);

  const filteredIssues = useMemo(() => {
    return {
      all: issues,
      seen: issues.filter(issue => seenIssueIds.has(issue.id)),
      unseen: issues.filter(issue => !seenIssueIds.has(issue.id)),
    };
  }, [issues, seenIssueIds]);

  const counts = useMemo(() => {
    return {
      all: issues.length,
      seen: filteredIssues.seen.length,
      unseen: filteredIssues.unseen.length,
    };
  }, [issues.length, filteredIssues.seen.length, filteredIssues.unseen.length]);

  return {
    issues: filteredIssues,
    counts,
    hasSeen: (issueId: string) => seenIssueIds.has(issueId),
  };
}
