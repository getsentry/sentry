import styled from '@emotion/styled';

import Alert from 'sentry/components/alert';
import LoadingContainer from 'sentry/components/loading/loadingContainer';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import SearchBar from 'sentry/components/performance/searchBar';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {NewQuery} from 'sentry/types';
import {defined} from 'sentry/utils';
import EventView from 'sentry/utils/discover/eventView';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useRouter from 'sentry/utils/useRouter';
import {prepareQueryForLandingPage} from 'sentry/views/performance/data';
import {getTransactionSearchQuery} from 'sentry/views/performance/utils';
import {useReleaseSelection} from 'sentry/views/starfish/queries/useReleases';
import {SpanMetricsField} from 'sentry/views/starfish/types';
import {formatVersionAndCenterTruncate} from 'sentry/views/starfish/utils/centerTruncate';
import {appendReleaseFilters} from 'sentry/views/starfish/utils/releaseComparison';
import {getFreeTextFromQuery} from 'sentry/views/starfish/views/screens';
import {
  ScreensTable,
  useTableQuery,
} from 'sentry/views/starfish/views/screens/screensTable';

const MAX_TABLE_RELEASE_CHARS = 15;

type Props = {
  additionalFilters?: string[];
  chartHeight?: number;
};

function AppStartup({additionalFilters}: Props) {
  const pageFilter = usePageFilters();
  const {selection} = pageFilter;
  const location = useLocation();
  const organization = useOrganization();
  const {query: locationQuery} = location;

  const {
    primaryRelease,
    secondaryRelease,
    isLoading: isReleasesLoading,
  } = useReleaseSelection();
  const truncatedPrimary = formatVersionAndCenterTruncate(
    primaryRelease ?? '',
    MAX_TABLE_RELEASE_CHARS
  );
  const truncatedSecondary = formatVersionAndCenterTruncate(
    secondaryRelease ?? '',
    MAX_TABLE_RELEASE_CHARS
  );

  const router = useRouter();

  const query = new MutableSearch([
    'event.type:transaction',
    'transaction.op:ui.load',
    ...(additionalFilters ?? []),
  ]);

  const searchQuery = decodeScalar(locationQuery.query, '');
  if (searchQuery) {
    query.addStringFilter(prepareQueryForLandingPage(searchQuery, false));
  }

  const queryString = appendReleaseFilters(query, primaryRelease, secondaryRelease);

  const orderby = decodeScalar(locationQuery.sort, `-count`);
  const newQuery: NewQuery = {
    name: '',
    fields: [
      'transaction',
      SpanMetricsField.PROJECT_ID,
      `avg_if(measurements.app_start_cold,release,${primaryRelease})`,
      `avg_if(measurements.app_start_cold,release,${secondaryRelease})`,
      `avg_if(measurements.app_start_warm,release,${primaryRelease})`,
      `avg_if(measurements.app_start_warm,release,${secondaryRelease})`,
      'count()',
    ],
    query: queryString,
    dataset: DiscoverDatasets.METRICS,
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
    referrer: 'api.starfish.mobile-startup-screen-table',
  });

  if (isReleasesLoading) {
    return (
      <LoadingContainer>
        <LoadingIndicator />
      </LoadingContainer>
    );
  }

  if (!defined(primaryRelease) && !isReleasesLoading) {
    return (
      <Alert type="warning" showIcon>
        {t(
          'No screens found on recent releases. Please try a single iOS or Android project, a single environment or a smaller date range.'
        )}
      </Alert>
    );
  }

  const derivedQuery = getTransactionSearchQuery(location, tableEventView.query);

  const tableSearchFilters = new MutableSearch([
    'event.type:transaction',
    'transaction.op:ui.load',
  ]);

  return (
    <div data-test-id="starfish-mobile-app-startup-view">
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
        placeholder={t('Search for Screens')}
        additionalConditions={
          new MutableSearch(
            appendReleaseFilters(tableSearchFilters, primaryRelease, secondaryRelease)
          )
        }
      />
      <ScreensTable
        eventView={tableEventView}
        data={topTransactionsData}
        isLoading={topTransactionsLoading}
        pageLinks={pageLinks}
        columnNameMap={{
          transaction: t('Screen'),
          [`avg_if(measurements.app_start_cold,release,${primaryRelease})`]: t(
            'Cold Start (%s)',
            truncatedPrimary
          ),
          [`avg_if(measurements.app_start_cold,release,${secondaryRelease})`]: t(
            'Cold Start (%s)',
            truncatedSecondary
          ),
          [`avg_if(measurements.app_start_warm,release,${primaryRelease})`]: t(
            'Warm Start (%s)',
            truncatedPrimary
          ),
          [`avg_if(measurements.app_start_warm,release,${secondaryRelease})`]: t(
            'Warm Start (%s)',
            truncatedSecondary
          ),
          'count()': t('Total Count'),
        }}
      />
    </div>
  );
}

export default AppStartup;

const StyledSearchBar = styled(SearchBar)`
  margin-bottom: ${space(1)};
`;
