import type {Location} from 'history';

import {getInterval} from 'sentry/components/charts/utils';
import type {PageFilters} from 'sentry/types/core';
import type {Group} from 'sentry/types/group';
import type {
  MultiSeriesEventsStats,
  NewQuery,
  Organization,
  SavedQuery,
} from 'sentry/types/organization';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {EventView} from 'sentry/utils/discover/eventView';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {getPeriod} from 'sentry/utils/duration/getPeriod';
import {getConfigForIssueType} from 'sentry/utils/issueTypeConfig';
import {useLocation} from 'sentry/utils/useLocation';
import {useGroupDefaultStatsPeriod} from 'sentry/views/issueDetails/useGroupDefaultStatsPeriod';
import {useEnvironmentsFromUrl} from 'sentry/views/issueDetails/utils';

import {useEventQuery} from './useEventQuery';

export function useIssueDetailsEventView({
  group,
  pageFilters,
  queryProps,
  isSmallContainer = false,
}: {
  group: Group;
  isSmallContainer?: boolean;
  pageFilters?: PageFilters;
  queryProps?: Partial<SavedQuery>;
}) {
  const searchQuery = useEventQuery();

  const location = useLocation();
  const environments = useEnvironmentsFromUrl();
  const hasSetStatsPeriod =
    location.query.statsPeriod || location.query.start || location.query.end;
  const defaultStatsPeriod = useGroupDefaultStatsPeriod(group, group.project);
  const periodQuery = pageFilters
    ? getPeriod(pageFilters.datetime)
    : hasSetStatsPeriod
      ? getPeriod({
          start: location.query.start as string,
          end: location.query.end as string,
          period: location.query.statsPeriod as string,
        })
      : defaultStatsPeriod;

  const interval = getInterval(
    {
      start: periodQuery?.start,
      end: periodQuery?.end,
      period: periodQuery?.statsPeriod,
    },
    // Switch to low fidelity intervals on small screens
    isSmallContainer ? 'low' : 'issues'
  );
  const config = getConfigForIssueType(group, group.project);

  // Group each filter so OR branches cannot escape the issue or other filters.
  const query = [
    `issue.id:${group.id}`,
    ...[searchQuery, queryProps?.query].filter(s => s && s.length > 0).map(s => `(${s})`),
  ].join(' ');

  const discoverQuery: NewQuery = {
    ...periodQuery,
    interval,
    environment: environments,
    dataset: config.usesIssuePlatform
      ? DiscoverDatasets.ISSUE_PLATFORM
      : DiscoverDatasets.ERRORS,
    version: 2,
    projects: [Number(group.project.id)],
    range: periodQuery?.statsPeriod,
    yAxis: ['count()', 'count_unique(user)'],
    fields: ['title', 'release', 'environment', 'user.display', 'timestamp'],
    name: group.title || group.type,
    ...queryProps,
    query,
  };
  return EventView.fromSavedQuery(discoverQuery);
}

interface IssueDetailsEventsQueryParams {
  eventView: EventView;
  group: Group;
  location: Location;
  organization: Organization;
  referrer: string;
}

function getIssueDetailsEventsQuery({
  eventView,
  group,
  location,
  referrer,
}: IssueDetailsEventsQueryParams) {
  return {
    ...eventView.getEventsAPIPayload(location),
    project: [group.project.id],
    query: eventView.query,
    interval: eventView.interval,
    yAxis: eventView.yAxis,
    partial: 1,
    // Cursor on issue details can be used for other pagination
    cursor: undefined,
    referrer,
  };
}

export function issueDetailsEventsStatsApiOptions(params: IssueDetailsEventsQueryParams) {
  return apiOptions.as<MultiSeriesEventsStats>()(
    '/organizations/$organizationIdOrSlug/events-stats/',
    {
      path: {organizationIdOrSlug: params.organization.slug},
      query: getIssueDetailsEventsQuery(params),
      staleTime: 60_000,
    }
  );
}

export function issueDetailsEventsApiOptions<T>({
  field,
  ...params
}: IssueDetailsEventsQueryParams & {
  /**
   * Overrides the event view's fields.
   */
  field?: string[];
}) {
  return apiOptions.as<T>()('/organizations/$organizationIdOrSlug/events/', {
    path: {organizationIdOrSlug: params.organization.slug},
    query: {
      ...getIssueDetailsEventsQuery(params),
      ...(field ? {field} : {}),
    },
    staleTime: 60_000,
  });
}
