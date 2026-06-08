import {useEffect} from 'react';
import type {Location} from 'history';

import {loadOrganizationTags} from 'sentry/actionCreators/tags';
import {LoadingContainer} from 'sentry/components/loading/loadingContainer';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import type {Organization} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useDiscoverQuery} from 'sentry/utils/discover/discoverQuery';
import {EventView} from 'sentry/utils/discover/eventView';
import type {QueryFieldValue} from 'sentry/utils/discover/fields';
import {useMetricsCardinalityContext} from 'sentry/utils/performance/contexts/metricsCardinality';
import {
  getIsMetricsDataFromResults,
  useMEPDataContext,
} from 'sentry/utils/performance/contexts/metricsEnhancedPerformanceDataContext';
import {MEPSettingProvider} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';
import {removeHistogramQueryStrings} from 'sentry/utils/performance/histogram';
import {useApi} from 'sentry/utils/useApi';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useGlobalAlerts} from 'sentry/views/app/globalAlerts';
import {
  decodeFilterFromLocation,
  filterToLocationQuery,
  SpanOperationBreakdownFilter,
} from 'sentry/views/performance/transactionSummary/filter';
import {useTransactionSummaryContext} from 'sentry/views/performance/transactionSummary/transactionSummaryContext';
import {addRoutePerformanceContext} from 'sentry/views/performance/utils';

import {ZOOM_END, ZOOM_START} from './latencyChart/utils';
import {EAPSummaryContent} from './content';

// Used to cast the totals request to numbers
// as string | number
type TotalValues = Record<string, number>;

function TransactionOverview() {
  const api = useApi();
  const organization = useOrganization();
  const {selection} = usePageFilters();
  const {addAlert} = useGlobalAlerts();

  useEffect(() => {
    loadOrganizationTags(api, organization.slug, selection, addAlert);
    addRoutePerformanceContext(selection);
    trackAnalytics('performance_views.transaction_summary.view', {
      organization,
    });
  }, [selection, organization, api, addAlert]);

  return (
    <MEPSettingProvider>
      <EAPCardinalityLoadingWrapper />
    </MEPSettingProvider>
  );
}

function EAPCardinalityLoadingWrapper() {
  const mepCardinalityContext = useMetricsCardinalityContext();

  if (mepCardinalityContext?.isLoading) {
    return <LoadingContainer isLoading />;
  }

  return <EAPOverviewContentWrapper />;
}

function EAPOverviewContentWrapper() {
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
    <EAPSummaryContent
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

function getEAPTotalsEventView(
  _organization: Organization,
  eventView: EventView
): EventView {
  const totalsColumns: QueryFieldValue[] = [
    {
      kind: 'function',
      function: ['p95', '', undefined, undefined],
    },
  ];

  return eventView.withColumns(totalsColumns);
}

export default TransactionOverview;
