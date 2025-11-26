import {useEffect, useMemo, useRef, useState} from 'react';
import styled from '@emotion/styled';
import type {Location} from 'history';

import {wrapQueryInWildcards} from 'sentry/components/performance/searchBar';
import SearchBar from 'sentry/components/searchBar';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {NewQuery} from 'sentry/types/organization';
import type {MetaType} from 'sentry/utils/discover/eventView';
import EventView from 'sentry/utils/discover/eventView';
import {getAggregateAlias} from 'sentry/utils/discover/fields';
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
  screens: string[],
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
  let queryString = query.formatString();

  if (screens.length > 0) {
    const screenFilter = `transaction:[${screens.map(name => `"${name}"`).join()}]`;
    queryString = queryString + ' ' + screenFilter;
  }

  return queryString;
};

const transactionMetricsFields = [
  SpanFields.PROJECT_ID,
  SpanFields.TRANSACTION,
  `count()`,
  'avg(measurements.app_start_cold)',
  'avg(measurements.app_start_warm)',
  `avg(measurements.time_to_initial_display)`,
  `avg(measurements.time_to_full_display)`,
] as const satisfies SpanProperty[];

const spanMetricsFields = [
  SpanFields.PROJECT_ID,
  SpanFields.TRANSACTION,
  `division(mobile.slow_frames,mobile.total_frames)`,
  `division(mobile.frozen_frames,mobile.total_frames)`,
  `avg(mobile.frames_delay)`,
] as const satisfies SpanProperty[];

export function ScreensOverview() {
  const navigate = useNavigate();
  const location = useLocation();
  const {selection} = usePageFilters();
  const {isProjectCrossPlatform, selectedPlatform} = useCrossPlatformProject();
  const [hasVisibleScreens, setHasVisibleScreens] = useState<boolean>(false);
  const {primaryRelease} = useReleaseSelection();
  const visibleScreensRef = useRef<string[]>([]);
  const sortedBy = decodeScalar(location.query.sort);
  const sort = (sortedBy && decodeSorts([sortedBy])[0]) || DEFAULT_SORT;
  const sortField = sort?.field;

  const isSpanPrimary = spanMetricsFields.some(
    field => getAggregateAlias(field) === sortField
  );

  const primaryQuery = getQueryString(
    location,
    [],
    isProjectCrossPlatform ? selectedPlatform : undefined,
    primaryRelease
  );
  const visibleScreenQuery = getQueryString(
    location,
    visibleScreensRef.current,
    isProjectCrossPlatform ? selectedPlatform : undefined,
    primaryRelease
  );

  // TODO: This is temporary while we are still using eventView here
  const newQuery: NewQuery = {
    name: '',
    fields: isSpanPrimary ? spanMetricsFields : transactionMetricsFields,
    query: primaryQuery,
    version: 2,
    projects: selection.projects,
  };
  if (sortedBy) {
    newQuery.orderby = sortedBy;
  }
  const primaryEventView = EventView.fromNewQueryWithLocation(newQuery, location);

  const spanMetricsQuery = isSpanPrimary ? primaryQuery : visibleScreenQuery;
  const metricsQuery = isSpanPrimary ? visibleScreenQuery : primaryQuery;

  const spanMetricsSorts = isSpanPrimary ? [sort] : [];
  const metricsSorts = isSpanPrimary ? [] : [sort];

  const spanMetricsResult = useSpans(
    {
      search: spanMetricsQuery,
      fields: spanMetricsFields,
      sorts: spanMetricsSorts,
      enabled: isSpanPrimary || hasVisibleScreens,
    },
    Referrer.SCREENS_SCREEN_TABLE_SPAN_METRICS
  );

  const metricsResult = useSpans(
    {
      search: metricsQuery,
      fields: transactionMetricsFields,
      sorts: metricsSorts,
      enabled: !isSpanPrimary || hasVisibleScreens,
    },
    Referrer.SCREENS_SCREEN_TABLE
  );

  const primaryResult = isSpanPrimary ? spanMetricsResult : metricsResult;
  const secondaryResult = isSpanPrimary ? metricsResult : spanMetricsResult;

  const {
    data: primaryData,
    meta: primaryMeta,
    isPending: primaryLoading,
    pageLinks: primaryLinks,
  } = primaryResult;
  const {
    data: secondaryData,
    meta: secondaryMeta,
    isPending: secondaryLoading,
  } = secondaryResult;

  useEffect(() => {
    if (primaryData) {
      const screens: string[] = [];
      primaryData?.forEach(row => {
        if (row.transaction) {
          screens.push(String(row.transaction));
        }
      });
      visibleScreensRef.current = screens;
      setHasVisibleScreens(screens.length > 0);
    }
  }, [primaryData]);

  const derivedQuery = getTransactionSearchQuery(location, primaryQuery);

  const combinedData = useMemo(() => {
    const meta: MetaType = {};
    meta.units = {
      ...secondaryMeta?.units,
      ...primaryMeta?.units,
    };
    meta.fields = {
      ...secondaryMeta?.fields,
      ...primaryMeta?.fields,
    };

    const data = primaryData.map(row => {
      const matchingRow = secondaryData.find(
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
  }, [primaryData, secondaryData, primaryMeta, secondaryMeta]);

  const loading = primaryLoading || (hasVisibleScreens && secondaryLoading);
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
