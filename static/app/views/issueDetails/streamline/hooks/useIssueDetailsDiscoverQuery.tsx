import {getInterval} from 'sentry/components/charts/utils';
import type {PageFilters} from 'sentry/types/core';
import type {Group} from 'sentry/types/group';
import type {NewQuery, SavedQuery} from 'sentry/types/organization';
import EventView from 'sentry/utils/discover/eventView';
import {
  type DiscoverQueryProps,
  useGenericDiscoverQuery,
} from 'sentry/utils/discover/genericDiscoverQuery';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {getPeriod} from 'sentry/utils/duration/getPeriod';
import {getConfigForIssueType} from 'sentry/utils/issueTypeConfig';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {useEventQuery} from 'sentry/views/issueDetails/streamline/eventSearch';
import {useGroupDefaultStatsPeriod} from 'sentry/views/issueDetails/useGroupDefaultStatsPeriod';

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
  const searchQuery = useEventQuery({groupId: group.id});

  const location = useLocation();
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

  const query = [`issue:${group.shortId}`, searchQuery, queryProps?.query]
    .filter(s => s && s.length > 0)
    .join(' ');

  const discoverQuery: NewQuery = {
    ...periodQuery,
    interval,
    environment: location.query.environment as NewQuery['environment'],
    dataset: config.usesIssuePlatform
      ? DiscoverDatasets.ISSUE_PLATFORM
      : DiscoverDatasets.ERRORS,
    version: 2,
    projects: [Number(group.project.id)],
    range: periodQuery?.statsPeriod,
    yAxis: ['count()', 'count_unique(user)'],
    fields: ['title', 'release', 'environment', 'user.display', 'timestamp'],
    name: group.title || group.type,
    orderby: location.query.sort ?? '-timestamp',
    ...queryProps,
    query,
  };
  return EventView.fromSavedQuery(discoverQuery);
}

export function useIssueDetailsDiscoverQuery<T>({
  params: {eventView, route, referrer},
  options,
}: {
  params: {
    eventView: EventView;
    referrer: string;
    route: string;
  };
  options?: DiscoverQueryProps['options'];
}) {
  const organization = useOrganization();
  const location = useLocation();
  return useGenericDiscoverQuery<T, DiscoverQueryProps>({
    route,
    eventView,
    location,
    orgSlug: organization.slug,
    getRequestPayload: () => ({
      ...eventView.getEventsAPIPayload(location),
      query: eventView.query,
      interval: eventView.interval,
      yAxis: eventView.yAxis,
      partial: 1,
      // Cursor on issue details can be used for other pagination
      cursor: undefined,
    }),
    options,
    referrer,
  });
}
