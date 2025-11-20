import {useEffect} from 'react';
import {useTheme, type Theme} from '@emotion/react';
import type {Location} from 'history';

import {loadOrganizationTags} from 'sentry/actionCreators/tags';
import LoadingContainer from 'sentry/components/loading/loadingContainer';
import type {Organization} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useDiscoverQuery} from 'sentry/utils/discover/discoverQuery';
import EventView from 'sentry/utils/discover/eventView';
import type {Column, QueryFieldValue} from 'sentry/utils/discover/fields';
import type {WebVital} from 'sentry/utils/fields';
import {useMetricsCardinalityContext} from 'sentry/utils/performance/contexts/metricsCardinality';
import {
  getIsMetricsDataFromResults,
  useMEPDataContext,
} from 'sentry/utils/performance/contexts/metricsEnhancedPerformanceDataContext';
import {
  MEPSettingProvider,
  useMEPSettingContext,
} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';
import {removeHistogramQueryStrings} from 'sentry/utils/performance/histogram';
import useApi from 'sentry/utils/useApi';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {useTransactionSummaryEAP} from 'sentry/views/performance/otlp/useTransactionSummaryEAP';
import {
  decodeFilterFromLocation,
  filterToLocationQuery,
  SpanOperationBreakdownFilter,
} from 'sentry/views/performance/transactionSummary/filter';
import {getTransactionMEPParamsIfApplicable} from 'sentry/views/performance/transactionSummary/transactionOverview/utils';
import {useTransactionSummaryContext} from 'sentry/views/performance/transactionSummary/transactionSummaryContext';
import {
  makeVitalGroups,
  PERCENTILE as VITAL_PERCENTILE,
} from 'sentry/views/performance/transactionSummary/transactionVitals/constants';
import {addRoutePerformanceContext} from 'sentry/views/performance/utils';

import {ZOOM_END, ZOOM_START} from './latencyChart/utils';
import SummaryContent, {OTelSummaryContent} from './content';

// Used to cast the totals request to numbers
// as string | number
type TotalValues = Record<string, number>;

function TransactionOverview() {
  const api = useApi();
  const organization = useOrganization();
  const {selection} = usePageFilters();

  useEffect(() => {
    loadOrganizationTags(api, organization.slug, selection);
    addRoutePerformanceContext(selection);
    trackAnalytics('performance_views.transaction_summary.view', {
      organization,
    });
  }, [selection, organization, api]);

  const shouldUseTransactionSummaryEAP = useTransactionSummaryEAP();

  return (
    <MEPSettingProvider>
      {shouldUseTransactionSummaryEAP ? (
        <EAPCardinalityLoadingWrapper />
      ) : (
        <CardinalityLoadingWrapper />
      )}
    </MEPSettingProvider>
  );
}

function CardinalityLoadingWrapper() {
  const mepCardinalityContext = useMetricsCardinalityContext();

  if (mepCardinalityContext.isLoading) {
    return <LoadingContainer isLoading />;
  }

  return <OverviewContentWrapper />;
}

function EAPCardinalityLoadingWrapper() {
  const mepCardinalityContext = useMetricsCardinalityContext();

  if (mepCardinalityContext.isLoading) {
    return <LoadingContainer isLoading />;
  }

  return <OTelOverviewContentWrapper />;
}

function OTelOverviewContentWrapper() {
  const {
    organization,
    eventView,
    projectId,
    transactionName,
    transactionThreshold,
    transactionThresholdMetric,
  } = useTransactionSummaryContext();

  const location = useLocation();
  const navigate = useNavigate();
  const mepContext = useMEPDataContext();

  const queryData = useDiscoverQuery({
    eventView: getEAPTotalsEventView(organization, eventView),
    orgSlug: organization.slug,
    location,
    transactionThreshold,
    transactionThresholdMetric,
    referrer: 'api.insights.transaction-summary',
    options: {
      refetchOnWindowFocus: false,
    },
  });

  // Count has to be total indexed events count because it's only used
  // in indexed events contexts
  const totalCountQueryData = useDiscoverQuery({
    eventView: getTotalCountEventView(organization, eventView),
    orgSlug: organization.slug,
    location,
    transactionThreshold,
    transactionThresholdMetric,
    referrer: 'api.insights.transaction-summary',
  });

  useEffect(() => {
    const isMetricsData = getIsMetricsDataFromResults(queryData.data);
    mepContext.setIsMetricsData(isMetricsData);
  }, [mepContext, queryData.data]);

  const {data: tableData, isPending, error} = queryData;
  const {
    data: totalCountTableData,
    isPending: isTotalCountQueryLoading,
    error: totalCountQueryError,
  } = totalCountQueryData;

  const spanOperationBreakdownFilter = decodeFilterFromLocation(location);

  const onChangeFilter = (newFilter: SpanOperationBreakdownFilter | undefined) => {
    trackAnalytics('performance_views.filter_dropdown.selection', {
      organization,
      action: newFilter as string,
    });

    const nextQuery: Location['query'] = {
      ...removeHistogramQueryStrings(location, [ZOOM_START, ZOOM_END]),
      ...filterToLocationQuery(newFilter),
    };

    if (newFilter === SpanOperationBreakdownFilter.NONE) {
      delete nextQuery.breakdown;
    }

    navigate({
      pathname: location.pathname,
      query: nextQuery,
    });
  };

  let totals: TotalValues | null =
    (tableData?.data?.[0] as Record<string, number>) ?? null;
  const totalCountData: TotalValues | null =
    (totalCountTableData?.data?.[0] as Record<string, number>) ?? null;

  // Count is always a count of indexed events,
  // while other fields could be either metrics or index based
  totals = {...totals, ...totalCountData};

  return (
    <OTelSummaryContent
      location={location}
      organization={organization}
      eventView={eventView}
      projectId={projectId}
      transactionName={transactionName}
      isLoading={isPending || isTotalCountQueryLoading}
      error={error || totalCountQueryError}
      totalValues={totals}
      onChangeFilter={onChangeFilter}
      spanOperationBreakdownFilter={spanOperationBreakdownFilter}
    />
  );
}

function OverviewContentWrapper() {
  const {
    organization,
    eventView,
    projectId,
    transactionName,
    transactionThreshold,
    transactionThresholdMetric,
  } = useTransactionSummaryContext();
  const theme = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const mepContext = useMEPDataContext();
  const mepSetting = useMEPSettingContext();
  const mepCardinalityContext = useMetricsCardinalityContext();
  const queryExtras = getTransactionMEPParamsIfApplicable(
    mepSetting,
    mepCardinalityContext,
    organization
  );

  const queryData = useDiscoverQuery({
    eventView: getTotalsEventView(organization, eventView, theme),
    orgSlug: organization.slug,
    location,
    transactionThreshold,
    transactionThresholdMetric,
    referrer: 'api.insights.transaction-summary',
    queryExtras,
    options: {
      refetchOnWindowFocus: false,
    },
  });

  // Count has to be total indexed events count because it's only used
  // in indexed events contexts
  const totalCountQueryData = useDiscoverQuery({
    eventView: getTotalCountEventView(organization, eventView),
    orgSlug: organization.slug,
    location,
    transactionThreshold,
    transactionThresholdMetric,
    referrer: 'api.insights.transaction-summary',
  });

  useEffect(() => {
    const isMetricsData = getIsMetricsDataFromResults(queryData.data);
    mepContext.setIsMetricsData(isMetricsData);
  }, [mepContext, queryData.data]);

  const {data: tableData, isPending, error} = queryData;
  const {
    data: totalCountTableData,
    isPending: isTotalCountQueryLoading,
    error: totalCountQueryError,
  } = totalCountQueryData;

  const spanOperationBreakdownFilter = decodeFilterFromLocation(location);

  const onChangeFilter = (newFilter: SpanOperationBreakdownFilter | undefined) => {
    trackAnalytics('performance_views.filter_dropdown.selection', {
      organization,
      action: newFilter as string,
    });

    const nextQuery: Location['query'] = {
      ...removeHistogramQueryStrings(location, [ZOOM_START, ZOOM_END]),
      ...filterToLocationQuery(newFilter),
    };

    if (newFilter === SpanOperationBreakdownFilter.NONE) {
      delete nextQuery.breakdown;
    }

    navigate({
      pathname: location.pathname,
      query: nextQuery,
    });
  };

  let totals: TotalValues | null =
    (tableData?.data?.[0] as Record<string, number>) ?? null;
  const totalCountData: TotalValues | null =
    (totalCountTableData?.data?.[0] as Record<string, number>) ?? null;

  // Count is always a count of indexed events,
  // while other fields could be either metrics or index based
  totals = {...totals, ...totalCountData};

  return (
    <SummaryContent
      location={location}
      organization={organization}
      eventView={eventView}
      projectId={projectId}
      transactionName={transactionName}
      isLoading={isPending || isTotalCountQueryLoading}
      error={error || totalCountQueryError}
      totalValues={totals}
      onChangeFilter={onChangeFilter}
      spanOperationBreakdownFilter={spanOperationBreakdownFilter}
    />
  );
}

function getTotalCountEventView(
  _organization: Organization,
  eventView: EventView
): EventView {
  const totalCountField: QueryFieldValue = {
    kind: 'function',
    function: ['count', '', undefined, undefined],
  };

  return eventView.withColumns([totalCountField]);
}

function getTotalsEventView(
  _organization: Organization,
  eventView: EventView,
  theme: Theme
): EventView {
  const vitals = makeVitalGroups(theme)
    .map(({vitals: vs}) => vs)
    .reduce((keys: WebVital[], vs) => {
      vs.forEach(vital => keys.push(vital));
      return keys;
    }, []);

  const totalsColumns: QueryFieldValue[] = [
    {
      kind: 'function',
      function: ['p95', '', undefined, undefined],
    },
    {
      kind: 'function',
      function: ['count_unique', 'user', undefined, undefined],
    },
    {
      kind: 'function',
      function: ['failure_rate', '', undefined, undefined],
    },
    {
      kind: 'function',
      function: ['tpm', '', undefined, undefined],
    },
    {
      kind: 'function',
      function: ['count_miserable', 'user', undefined, undefined],
    },
    {
      kind: 'function',
      function: ['user_misery', '', undefined, undefined],
    },
    {
      kind: 'function',
      function: ['apdex', '', undefined, undefined],
    },
    {
      kind: 'function',
      function: ['sum', 'transaction.duration', undefined, undefined],
    },
  ];

  return eventView.withColumns([
    ...totalsColumns,
    ...vitals.map(
      vital =>
        ({
          kind: 'function',
          function: ['percentile', vital, VITAL_PERCENTILE.toString(), undefined],
        }) as Column
    ),
  ]);
}

function getEAPTotalsEventView(
  _organization: Organization,
  eventView: EventView
): EventView {
  const totalsColumns: QueryFieldValue[] = [
    {
      kind: 'function',
      function: ['p95', '', undefined, undefined],
    },
    {
      kind: 'function',
      function: ['count_unique', 'user', undefined, undefined],
    },
  ];

  return eventView.withColumns([...totalsColumns]);
}

export default TransactionOverview;
