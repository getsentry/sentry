import {getInterval} from 'sentry/components/charts/utils';
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
import usePageFilters from 'sentry/utils/usePageFilters';
import {useEventQuery} from 'sentry/views/issueDetails/streamline/eventSearch';

export function useIssueDetailsEventView({
  group,
  queryProps,
}: {
  group: Group;
  queryProps?: Partial<SavedQuery>;
}) {
  const {selection: pageFilters} = usePageFilters();
  const searchQuery = useEventQuery({group});
  const periodQuery = getPeriod(pageFilters.datetime);
  const interval = getInterval(pageFilters.datetime, 'low');
  const config = getConfigForIssueType(group, group.project);

  const {query: propQuery = '', ...overrideQueryProps} = queryProps ?? {};
  const query = [`issue:${group.shortId}`, searchQuery, propQuery]
    .filter(s => s.length > 0)
    .join(' ');

  const discoverQuery: NewQuery = {
    ...periodQuery,
    interval,
    environment: pageFilters.environments,
    dataset: config.usesIssuePlatform
      ? DiscoverDatasets.ISSUE_PLATFORM
      : DiscoverDatasets.ERRORS,
    version: 2,
    projects: [Number(group.project.id)],
    range: periodQuery.statsPeriod,
    yAxis: ['count()', 'count_unique(user)'],
    fields: ['title', 'release', 'environment', 'user.display', 'timestamp'],
    name: group.title || group.type,
    query,
    ...overrideQueryProps,
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
    }),
    options,
    referrer,
  });
}
