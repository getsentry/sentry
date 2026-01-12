import styled from '@emotion/styled';
import type {Location} from 'history';

import {wrapQueryInWildcards} from 'sentry/components/performance/searchBar';
import SearchBar from 'sentry/components/searchBar';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {NewQuery} from 'sentry/types/organization';
import EventView from 'sentry/utils/discover/eventView';
import {decodeScalar, decodeSorts} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import usePageFilters from 'sentry/utils/usePageFilters';
import {useSpans} from 'sentry/views/insights/common/queries/useDiscover';
import {useReleaseSelection} from 'sentry/views/insights/common/queries/useReleases';
import useCrossPlatformProject from 'sentry/views/insights/mobile/common/queries/useCrossPlatformProject';
import ScreensOverviewTable from 'sentry/views/insights/mobile/screens/components/screensOverviewTable';
import {Referrer} from 'sentry/views/insights/mobile/screens/referrers';
import {DEFAULT_SORT} from 'sentry/views/insights/mobile/screens/settings';
import {SpanFields, type SpanProperty} from 'sentry/views/insights/types';
import {getTransactionSearchQuery} from 'sentry/views/performance/utils';

const getQueryString = (
  location: Location,
  selectedPlatform: string | undefined,
  selectedRelease: string | undefined
) => {
  const {query: locationQuery} = location;
  const query = new MutableSearch(['transaction.op:[ui.load,navigation]']);

  const searchQuery = decodeScalar(locationQuery.query, '');

  if (searchQuery) {
    query.addFilterValue('transaction', wrapQueryInWildcards(searchQuery), false);
  }
  if (selectedPlatform) {
    query.addFilterValue('os.name', selectedPlatform);
  }
  if (selectedRelease && selectedRelease !== '') {
    query.addFilterValue('release', selectedRelease);
  }

  const queryString = query.formatString();

  return queryString;
};

const fields = [
  SpanFields.PROJECT_ID,
  SpanFields.TRANSACTION,
  `count()`,
  'avg(measurements.app_start_cold)',
  'avg(measurements.app_start_warm)',
  `avg(measurements.time_to_initial_display)`,
  `avg(measurements.time_to_full_display)`,
  `division(mobile.slow_frames,mobile.total_frames)`,
  `division(mobile.frozen_frames,mobile.total_frames)`,
  `avg(mobile.frames_delay)`,
] as const satisfies SpanProperty[];

export function ScreensOverview() {
  const navigate = useNavigate();
  const location = useLocation();
  const {selection} = usePageFilters();
  const {isProjectCrossPlatform, selectedPlatform} = useCrossPlatformProject();
  const {primaryRelease} = useReleaseSelection();
  const sortedBy = decodeScalar(location.query.sort);
  const sort = (sortedBy && decodeSorts([sortedBy])[0]) || DEFAULT_SORT;

  const queryString = getQueryString(
    location,
    isProjectCrossPlatform ? selectedPlatform : undefined,
    primaryRelease
  );

  // TODO: This is temporary while we are still using eventView here
  const newQuery: NewQuery = {
    name: '',
    fields,
    query: queryString,
    version: 2,
    projects: selection.projects,
  };

  if (sortedBy) {
    newQuery.orderby = sortedBy;
  }

  const eventView = EventView.fromNewQueryWithLocation(newQuery, location);

  const {data, meta, isPending, pageLinks} = useSpans(
    {
      search: queryString,
      fields,
      sorts: [sort],
    },
    Referrer.SCREENS_SCREEN_TABLE_SPAN_METRICS
  );

  const derivedQuery = getTransactionSearchQuery(location, queryString);

  return (
    <Container>
      <SearchBar
        onSearch={search => {
          navigate({
            pathname: location.pathname,
            query: {
              ...location.query,
              cursor: undefined,
              query: String(search).trim() || undefined,
            },
          });
        }}
        query={getFreeTextFromQuery(derivedQuery)}
        placeholder={t('Search for Screen')}
      />
      <Container>
        <ScreensOverviewTable
          eventView={eventView}
          data={{
            data,
            meta: meta!,
          }}
          isLoading={isPending}
          pageLinks={pageLinks}
        />
      </Container>
    </Container>
  );
}

const Container = styled('div')`
  padding-top: ${space(1)};
`;

const getFreeTextFromQuery = (query: string) => {
  const conditions = new MutableSearch(query);
  const transactionValues = conditions.getFilterValues('transaction');
  if (transactionValues.length) {
    return transactionValues[0];
  }
  if (conditions.freeText.length > 0) {
    // raw text query will be wrapped in wildcards in generatePerformanceEventView
    // so no need to wrap it here
    return conditions.freeText.join(' ');
  }
  return '';
};
