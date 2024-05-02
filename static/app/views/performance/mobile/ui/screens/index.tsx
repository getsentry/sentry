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
import {prepareQueryForLandingPage} from 'sentry/views/performance/data';
import {getFreeTextFromQuery} from 'sentry/views/performance/mobile/screenload/screens';
import {useTableQuery} from 'sentry/views/performance/mobile/screenload/screens/screensTable';
import {Referrer} from 'sentry/views/performance/mobile/ui/referrers';
import {UIScreensTable} from 'sentry/views/performance/mobile/ui/screens/table';
import {getTransactionSearchQuery} from 'sentry/views/performance/utils';
import {useReleaseSelection} from 'sentry/views/starfish/queries/useReleases';
import {SpanMetricsField} from 'sentry/views/starfish/types';
import {appendReleaseFilters} from 'sentry/views/starfish/utils/releaseComparison';

export function UIScreens() {
  const router = useRouter();
  const {selection} = usePageFilters();
  const location = useLocation();
  const organization = useOrganization();
  const {query: locationQuery} = location;

  const {
    primaryRelease,
    secondaryRelease,
    isLoading: isReleasesLoading,
  } = useReleaseSelection();

  // TODO: Add transaction.op:ui.load when collecting begins
  const query = new MutableSearch([]);

  const searchQuery = decodeScalar(locationQuery.query, '');
  if (searchQuery) {
    query.addStringFilter(prepareQueryForLandingPage(searchQuery, false));
  }

  const queryString = appendReleaseFilters(query, primaryRelease, secondaryRelease);

  // TODO: Replace with a default sort on the count column when added
  const orderby = decodeScalar(locationQuery.sort, '');
  const newQuery: NewQuery = {
    name: '',
    fields: [
      SpanMetricsField.PROJECT_ID,
      'transaction',
      `avg_if(mobile.slow_frames,release,${primaryRelease})`,
      `avg_if(mobile.slow_frames,release,${secondaryRelease})`,
      `avg_if(mobile.frozen_frames,release,${primaryRelease})`,
      `avg_if(mobile.frozen_frames,release,${secondaryRelease})`,
      `avg_if(mobile.frames_delay,release,${primaryRelease})`,
      `avg_if(mobile.frames_delay,release,${secondaryRelease})`,
      `avg_compare(mobile.slow_frames,release,${primaryRelease},${secondaryRelease})`,
      `avg_compare(mobile.frozen_frames,release,${primaryRelease},${secondaryRelease})`,
      `avg_compare(mobile.frames_delay,release,${primaryRelease},${secondaryRelease})`,
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
    enabled: !isReleasesLoading,
    referrer: Referrer.OVERVIEW_SCREENS_TABLE,
  });

  // TODO: Add transaction.op:ui.load when collecting begins
  const tableSearchFilters = new MutableSearch([]);

  const derivedQuery = getTransactionSearchQuery(location, tableEventView.query);

  return (
    <div>
      <StyledSearchBar
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
        additionalConditions={
          new MutableSearch(
            appendReleaseFilters(tableSearchFilters, primaryRelease, secondaryRelease)
          )
        }
      />
      <UIScreensTable
        eventView={tableEventView}
        data={topTransactionsData}
        isLoading={topTransactionsLoading}
        pageLinks={pageLinks}
      />
    </div>
  );
}

const StyledSearchBar = styled(SearchBar)`
  margin-bottom: ${space(1)};
`;
