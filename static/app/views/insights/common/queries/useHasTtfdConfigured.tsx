import type {NewQuery} from 'sentry/types/organization';
import EventView from 'sentry/utils/discover/eventView';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import usePageFilters from 'sentry/utils/usePageFilters';
import {useReleaseSelection} from 'sentry/views/insights/common/queries/useReleases';
import {appendReleaseFilters} from 'sentry/views/insights/common/utils/releaseComparison';
import {useTableQuery} from 'sentry/views/insights/mobile/screenload/components/tables/screensTable';

export function useTTFDConfigured(additionalFilters?: string[]) {
  const location = useLocation();

  const {
    primaryRelease,
    secondaryRelease,
    isLoading: isReleasesLoading,
  } = useReleaseSelection();

  const {selection} = usePageFilters();

  const query = new MutableSearch([
    'event.type:transaction',
    'transaction.op:ui.load',
    ...(additionalFilters ?? []),
  ]);

  const queryString = appendReleaseFilters(query, primaryRelease, secondaryRelease);

  const newQuery: NewQuery = {
    name: '',
    fields: [
      `avg(measurements.time_to_initial_display)`,
      `avg(measurements.time_to_full_display)`,
      'count()',
    ],
    query: queryString,
    dataset: DiscoverDatasets.METRICS,
    version: 2,
    projects: selection.projects,
  };
  const eventView = EventView.fromNewQueryWithLocation(newQuery, location);

  const result = useTableQuery({
    eventView,
    enabled: !isReleasesLoading,
    staleTime: Infinity,
  });

  const hasTTFD: boolean | undefined = result.data?.data?.length
    ? !(
        result.data.data?.[0]!['avg(measurements.time_to_initial_display)'] !== 0 &&
        result.data.data?.[0]!['avg(measurements.time_to_full_display)'] === 0
      )
    : undefined;

  return {...result, hasTTFD};
}
