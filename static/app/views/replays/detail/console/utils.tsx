import type {BreadcrumbTypeDefault, Crumb} from 'sentry/types/breadcrumbs';

export function breadcrumbHasIssue(breadcrumb: Extract<Crumb, BreadcrumbTypeDefault>) {
  const {groupId, groupShortId, eventId} = breadcrumb.data || {};
  return groupId && groupShortId && eventId;
}
