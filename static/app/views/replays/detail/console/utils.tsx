import type {BreadcrumbTypeDefault, Crumb} from 'sentry/types/breadcrumbs';

export function breadcrumbHasIssue(breadcrumb: Extract<Crumb, BreadcrumbTypeDefault>) {
  const {groupId, groupShortId, eventId} = breadcrumb.data || {};
  return groupId && groupShortId && eventId;
}

export function sortBySeverity(a: string, b: string) {
  const levels = {
    issue: 0,
    fatal: 1,
    error: 2,
    warning: 3,
    info: 4,
    debug: 5,
    trace: 6,
  };

  const aRank = levels[a] ?? 10;
  const bRank = levels[b] ?? 10;
  return aRank - bRank;
}
