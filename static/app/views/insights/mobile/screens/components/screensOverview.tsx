import {useEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import type {Location} from 'history';

import SearchBar from 'sentry/components/performance/searchBar';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {PageFilters} from 'sentry/types/core';
import type {NewQuery} from 'sentry/types/organization';
import {defined} from 'sentry/utils';
import type {TableData} from 'sentry/utils/discover/discoverQuery';
import EventView, {type MetaType} from 'sentry/utils/discover/eventView';
import {getAggregateAlias} from 'sentry/utils/discover/fields';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {decodeScalar, decodeSorts} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useRouter from 'sentry/utils/useRouter';
import useCrossPlatformProject from 'sentry/views/insights/mobile/common/queries/useCrossPlatformProject';
import {getFreeTextFromQuery} from 'sentry/views/insights/mobile/screenload/components/screensView';
import {useTableQuery} from 'sentry/views/insights/mobile/screenload/components/tables/screensTable';
import ScreensOverviewTable from 'sentry/views/insights/mobile/screens/components/screensOverviewTable';
import {Referrer} from 'sentry/views/insights/mobile/screens/referrers';
import {SpanMetricsField} from 'sentry/views/insights/types';
import {prepareQueryForLandingPage} from 'sentry/views/performance/data';
import {getTransactionSearchQuery} from 'sentry/views/performance/utils';

function useMetrics(
  dataset: DiscoverDatasets,
  fields: string[],
  selectedPlatform: string | undefined,
  selection: PageFilters,
  location: Location,
  sortedBy: string | undefined,
  enabled: boolean,
  screens: string[]
) {
  const {query: locationQuery} = location;
  const query = new MutableSearch(['transaction.op:ui.load']);

  const searchQuery = decodeScalar(locationQuery.query, '');
  if (searchQuery) {
    query.addStringFilter(prepareQueryForLandingPage(searchQuery, false));
  }
  if (selectedPlatform) {
    query.addFilterValue('os.name', selectedPlatform);
  }
  let queryString = query.formatString();

  if (screens.length > 0) {
    const screenFilter = `transaction:[${screens.map(name => `"${name}"`).join()}]`;
    queryString = queryString + ' ' + screenFilter;
  }

  const newQuery: NewQuery = {
    name: '',
    fields,
    query: queryString,
    dataset,
    version: 2,
    projects: selection.projects,
  };
  if (sortedBy) {
    newQuery.orderby = sortedBy;
  }
  const tableEventView = EventView.fromNewQueryWithLocation(newQuery, location);

  return {
    eventView: tableEventView,
    ...useTableQuery({
      eventView: tableEventView,
      enabled,
      referrer: Referrer.SCREENS_SCREEN_TABLE,
    }),
  };
}

export function ScreensOverview() {
  const router = useRouter();
  const {selection} = usePageFilters();
  const location = useLocation();
  const organization = useOrganization();
  const {isProjectCrossPlatform, selectedPlatform} = useCrossPlatformProject();
  const [visibleScreens, setVisibleScreens] = useState<string[]>([]);
  const sortedBy = decodeScalar(location.query.sort, '-count');
  const sortField = decodeSorts([sortedBy])[0].field;

  const transactionMetricsDataset = DiscoverDatasets.METRICS;
  const transactionMetricsFields = [
    SpanMetricsField.PROJECT_ID,
    SpanMetricsField.TRANSACTION,
    `count()`,
    'avg(measurements.app_start_cold)',
    'avg(measurements.app_start_warm)',
    `avg(measurements.time_to_initial_display)`,
    `avg(measurements.time_to_full_display)`,
  ];

  const spanMetricsDataset = DiscoverDatasets.SPANS_METRICS;
  const spanMetricsFields = [
    SpanMetricsField.PROJECT_ID,
    SpanMetricsField.TRANSACTION,
    `avg(mobile.slow_frames)`,
    `avg(mobile.frozen_frames)`,
    `avg(mobile.frames_delay)`,
  ];

  const isSpanPrimary = spanMetricsFields.some(
    field => getAggregateAlias(field) === sortField
  );
  const primaryDataset = isSpanPrimary ? spanMetricsDataset : transactionMetricsDataset;
  const primaryFields = isSpanPrimary ? spanMetricsFields : transactionMetricsFields;

  const secondaryDataset = isSpanPrimary ? transactionMetricsDataset : spanMetricsDataset;
  const secondaryFields = isSpanPrimary ? transactionMetricsFields : spanMetricsFields;

  const {
    data: primaryData,
    isPending: primaryLoading,
    pageLinks: primaryLinks,
    eventView: primaryEventView,
  } = useMetrics(
    primaryDataset,
    primaryFields,
    isProjectCrossPlatform ? selectedPlatform : undefined,
    selection,
    location,
    sortedBy,
    true,
    []
  );

  const {data: secondaryData, isPending: secondaryLoading} = useMetrics(
    secondaryDataset,
    secondaryFields,
    isProjectCrossPlatform ? selectedPlatform : undefined,
    selection,
    location,
    undefined,
    visibleScreens.length > 0,
    visibleScreens
  );

  useEffect(() => {
    if (primaryData) {
      const screens: string[] = new Array();
      primaryData?.data.forEach(row => {
        if (row.transaction) {
          screens.push(String(row.transaction));
        }
      });
      setVisibleScreens(screens);
    }
  }, [primaryData]);

  const tableSearchFilters = new MutableSearch(['transaction.op:ui.load']);
  const derivedQuery = getTransactionSearchQuery(location, primaryEventView.query);

  const combinedData = useMemo((): TableData | undefined => {
    if (defined(primaryData) && defined(secondaryData)) {
      const meta: MetaType = {};
      meta.units = {
        ...secondaryData.meta?.units,
        ...primaryData.meta?.units,
      };
      meta.fields = {
        ...secondaryData.meta?.fields,
        ...primaryData.meta?.fields,
      };

      const data = primaryData.data.map(row => {
        const matchingRow = secondaryData.data.find(
          metricRow => metricRow.transaction === row.transaction
        );
        if (matchingRow) {
          return {
            ...matchingRow,
            ...row,
          };
        }
        return row;
      });

      return {
        data,
        meta,
      };
    }

    return primaryData;
  }, [primaryData, secondaryData]);

  const loading = primaryLoading || secondaryLoading;

  return (
    <Container>
      <SearchBar
        eventView={primaryEventView}
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
        additionalConditions={tableSearchFilters}
      />
      <Container>
        <ScreensOverviewTable
          eventView={primaryEventView}
          data={combinedData}
          isLoading={loading}
          pageLinks={primaryLinks}
        />
      </Container>
    </Container>
  );
}

const Container = styled('div')`
  padding-top: ${space(1)};
`;

export default ScreensOverview;
