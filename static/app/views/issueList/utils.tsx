import type {Location, LocationDescriptorObject} from 'history';

import {t} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import type {Group, GroupTombstoneHelper} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';

export const DEFAULT_QUERY = 'is:unresolved issue.priority:[high, medium]';

export enum Query {
  FOR_REVIEW = 'is:unresolved is:for_review assigned_or_suggested:[me, my_teams, none]',
  PRIORITIZED = DEFAULT_QUERY, // eslint-disable-line @typescript-eslint/prefer-literal-enum-member
  UNRESOLVED = 'is:unresolved',
  IGNORED = 'is:ignored',
  NEW = 'is:new',
  ARCHIVED = 'is:archived',
  ESCALATING = 'is:escalating',
  REGRESSED = 'is:regressed',
  REPROCESSING = 'is:reprocessing',
}

export function isForReviewQuery(query: string | undefined) {
  return !!query && /\bis:for_review\b/.test(query);
}

export enum IssueSortOptions {
  DATE = 'date',
  NEW = 'new',
  TRENDS = 'trends',
  FREQ = 'freq',
  USER = 'user',
  INBOX = 'inbox',
}

export const DEFAULT_ISSUE_STREAM_SORT = IssueSortOptions.DATE;

export function getSortLabel(key: string) {
  switch (key) {
    case IssueSortOptions.NEW:
      return t('Age');
    case IssueSortOptions.TRENDS:
      return t('Trends');
    case IssueSortOptions.FREQ:
      return t('Events');
    case IssueSortOptions.USER:
      return t('Users');
    case IssueSortOptions.INBOX:
      return t('Date Added');
    case IssueSortOptions.DATE:
    default:
      return t('Last Seen');
  }
}

export const DISCOVER_EXCLUSION_FIELDS: string[] = [
  'query',
  'status',
  'bookmarked_by',
  'assigned',
  'assigned_to',
  'unassigned',
  'subscribed_by',
  'active_at',
  'first_release',
  'first_seen',
  'is',
  '__text',
  'issue.priority',
  'issue.category',
  'issue.type',
  'issue.seer_actionability',
  'issue.seer_last_run',
  'detector',
];

export const FOR_REVIEW_QUERIES: string[] = [Query.FOR_REVIEW];

export const SAVED_SEARCHES_SIDEBAR_OPEN_LOCALSTORAGE_KEY =
  'issue-stream-saved-searches-sidebar-open';

export function createIssueLink({
  organization,
  data,
  eventId,
  referrer,
  location,
  query,
}: {
  data: Event | Group | GroupTombstoneHelper;
  location: Location;
  organization: Organization;
  eventId?: string;
  query?: string;
  referrer?: string;
}): LocationDescriptorObject {
  const {id, project} = data as Group;
  const {eventID: latestEventId, groupID} = data as Event;

  // If we have passed in a custom event ID, use it; otherwise use default
  const finalEventId = eventId ?? latestEventId;

  return {
    pathname: `/organizations/${organization.slug}/issues/${
      latestEventId ? groupID : id
    }/${finalEventId ? `events/${finalEventId}/` : ''}`,
    query: {
      referrer: referrer || 'event-or-group-header',
      query,
      // Add environment to the query if it was selected
      ...(location.query.environment === undefined
        ? {}
        : {environment: location.query.environment}),
      // This adds sort to the query if one was selected from the
      // issues list page
      ...(location.query.sort === undefined ? {} : {sort: location.query.sort}),
      // This appends _allp to the URL parameters if they have no
      // project selected ("all" projects included in results). This is
      // so that when we enter the issue details page and lock them to
      // a project, we can properly take them back to the issue list
      // page with no project selected (and not the locked project
      // selected)
      ...(location.query.project === undefined ? {_allp: 1} : {}),
      ...(project ? {project: project.id} : {}),
    },
  };
}
