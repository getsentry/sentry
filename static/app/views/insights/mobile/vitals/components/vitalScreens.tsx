import styled from '@emotion/styled';

import SearchBar from 'sentry/components/performance/searchBar';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {NewQuery} from 'sentry/types';
import EventView from 'sentry/utils/discover/eventView';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useRouter from 'sentry/utils/useRouter';
import useCrossPlatformProject from 'sentry/views/insights/mobile/common/queries/useCrossPlatformProject';
import {getFreeTextFromQuery} from 'sentry/views/insights/mobile/screenload/components/screensView';
import {useTableQuery} from 'sentry/views/insights/mobile/screenload/components/tables/screensTable';
import {Referrer} from 'sentry/views/insights/mobile/ui/referrers';
import VitalsScreensTable from 'sentry/views/insights/mobile/vitals/components/vitalsScreensTable';
import {SpanMetricsField} from 'sentry/views/insights/types';
import {prepareQueryForLandingPage} from 'sentry/views/performance/data';
import {getTransactionSearchQuery} from 'sentry/views/performance/utils';

export function VitalScreens() {
  const router = useRouter();
  const {selection} = usePageFilters();
  const location = useLocation();
  const organization = useOrganization();
  const {isProjectCrossPlatform, selectedPlatform} = useCrossPlatformProject();

  const {query: locationQuery} = location;

  const query = new MutableSearch(['transaction.op:ui.load']);

  const searchQuery = decodeScalar(locationQuery.query, '');
  if (searchQuery) {
    query.addStringFilter(prepareQueryForLandingPage(searchQuery, false));
  }
  if (isProjectCrossPlatform) {
    query.addFilterValue('os.name', selectedPlatform);
  }
  const queryString = query.formatString();

  const orderby = decodeScalar(locationQuery.sort, '-count');
  const newQuery: NewQuery = {
    name: '',
    fields: [
      SpanMetricsField.PROJECT_ID,
      'transaction',
      `count()`,
      `avg(mobile.slow_frames)`,
      `avg(mobile.frozen_frames)`,
      `avg(mobile.frames_delay)`,
    ],
    query: queryString,
    dataset: DiscoverDatasets.SPANS_METRICS,
    version: 2,
    projects: selection.projects,
  };
  newQuery.orderby = orderby;
  const tableEventView = EventView.fromNewQueryWithLocation(newQuery, location);

  const {
    data: topTransactionsData,
    isLoading: topTransactionsLoading,
    pageLinks,
  } = useTableQuery({
    eventView: tableEventView,
    enabled: true,
    referrer: Referrer.OVERVIEW_SCREENS_TABLE,
  });

  const tableSearchFilters = new MutableSearch(['transaction.op:ui.load']);
  const derivedQuery = getTransactionSearchQuery(location, tableEventView.query);

  return (
    <Container>
      <SearchBar
        eventView={tableEventView}
        onSearch={search => {
          router.push({
            pathname: router.location.pathname,
            query: {
              ...location.query,
              cursor: undefined,
              query: String(search).trim() || undefined,
            },
          });
        }}
        organization={organization}
        query={getFreeTextFromQuery(derivedQuery)}
        placeholder={t('Search for Screen')}
        additionalConditions={new MutableSearch(tableSearchFilters.formatString())}
      />
      <Container>
        <VitalsScreensTable
          eventView={tableEventView}
          data={topTransactionsData}
          isLoading={topTransactionsLoading}
          pageLinks={pageLinks}
        />
      </Container>
    </Container>
  );
}

const Container = styled('div')`
  padding-top: ${space(1)};
`;

export default VitalScreens;
