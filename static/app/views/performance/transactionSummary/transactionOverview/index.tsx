import {useEffect} from 'react';
import type {Location} from 'history';

import {loadOrganizationTags} from 'sentry/actionCreators/tags';
import LoadingContainer from 'sentry/components/loading/loadingContainer';
import {t} from 'sentry/locale';
import type {PageFilters} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useDiscoverQuery} from 'sentry/utils/discover/discoverQuery';
import EventView from 'sentry/utils/discover/eventView';
import type {QueryFieldValue} from 'sentry/utils/discover/fields';
import {isAggregateField} from 'sentry/utils/discover/fields';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
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
import {decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import useApi from 'sentry/utils/useApi';
import {useNavigate} from 'sentry/utils/useNavigate';
import withOrganization from 'sentry/utils/withOrganization';
import withPageFilters from 'sentry/utils/withPageFilters';
import withProjects from 'sentry/utils/withProjects';
import {getTransactionMEPParamsIfApplicable} from 'sentry/views/performance/transactionSummary/transactionOverview/utils';

import {addRoutePerformanceContext} from '../../utils';
import {
  decodeFilterFromLocation,
  filterToLocationQuery,
  SpanOperationBreakdownFilter,
} from '../filter';
import type {ChildProps} from '../pageLayout';
import PageLayout from '../pageLayout';
import Tab from '../tabs';

import {ZOOM_END, ZOOM_START} from './latencyChart/utils';
import SummaryContent, {OTelSummaryContent} from './content';

// Used to cast the totals request to numbers
// as React.ReactText
type TotalValues = Record<string, number>;

type Props = {
  location: Location;
  organization: Organization;
  projects: Project[];
  selection: PageFilters;
};

function TransactionOverview(props: Props) {
  const api = useApi();

  const {location, selection, organization, projects} = props;

  useEffect(() => {
    loadOrganizationTags(api, organization.slug, selection);
    addRoutePerformanceContext(selection);
    trackAnalytics('performance_views.transaction_summary.view', {
      organization,
    });
  }, [selection, organization, api]);

  const isEAP = organization.features.includes('performance-transaction-summary-eap');

  return (
    <MEPSettingProvider>
      <PageLayout
        location={location}
        organization={organization}
        projects={projects}
        tab={Tab.TRANSACTION_SUMMARY}
        getDocumentTitle={getDocumentTitle}
        generateEventView={generateEventView}
        childComponent={isEAP ? EAPCardinalityLoadingWrapper : CardinalityLoadingWrapper}
      />
    </MEPSettingProvider>
  );
}

function CardinalityLoadingWrapper(props: ChildProps) {
  const mepCardinalityContext = useMetricsCardinalityContext();

  if (mepCardinalityContext.isLoading) {
    return <LoadingContainer isLoading />;
  }

  return <OverviewContentWrapper {...props} />;
}

function EAPCardinalityLoadingWrapper(props: ChildProps) {
  const mepCardinalityContext = useMetricsCardinalityContext();

  if (mepCardinalityContext.isLoading) {
    return <LoadingContainer isLoading />;
  }

  return <OTelOverviewContentWrapper {...props} />;
}

function OTelOverviewContentWrapper(props: ChildProps) {
  const {
    location,
    organization,
    eventView,
    projectId,
    transactionName,
    transactionThreshold,
    transactionThresholdMetric,
  } = props;

  const navigate = useNavigate();

  const mepContext = useMEPDataContext();

  const queryData = useDiscoverQuery({
    eventView: getTotalsEventView(organization, eventView),
    orgSlug: organization.slug,
    location,
    transactionThreshold,
    transactionThresholdMetric,
    referrer: 'api.performance.transaction-summary',
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
    referrer: 'api.performance.transaction-summary',
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

  const onChangeFilter = (newFilter: SpanOperationBreakdownFilter) => {
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
    (tableData?.data?.[0] as {
      [k: string]: number;
    }) ?? null;
  const totalCountData: TotalValues | null =
    (totalCountTableData?.data?.[0] as {[k: string]: number}) ?? null;

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

function OverviewContentWrapper(props: ChildProps) {
  const {
    location,
    organization,
    eventView,
    projectId,
    transactionName,
    transactionThreshold,
    transactionThresholdMetric,
  } = props;

  const navigate = useNavigate();

  const mepContext = useMEPDataContext();
  const mepSetting = useMEPSettingContext();
  const mepCardinalityContext = useMetricsCardinalityContext();
  const queryExtras = getTransactionMEPParamsIfApplicable(
    mepSetting,
    mepCardinalityContext,
    organization
  );

  const queryData = useDiscoverQuery({
    eventView: getTotalsEventView(organization, eventView),
    orgSlug: organization.slug,
    location,
    transactionThreshold,
    transactionThresholdMetric,
    referrer: 'api.performance.transaction-summary',
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
    referrer: 'api.performance.transaction-summary',
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

  const onChangeFilter = (newFilter: SpanOperationBreakdownFilter) => {
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
    (tableData?.data?.[0] as {
      [k: string]: number;
    }) ?? null;
  const totalCountData: TotalValues | null =
    (totalCountTableData?.data?.[0] as {[k: string]: number}) ?? null;

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

function getDocumentTitle(transactionName: string): string {
  const hasTransactionName =
    typeof transactionName === 'string' && String(transactionName).trim().length > 0;

  if (hasTransactionName) {
    return [String(transactionName).trim(), t('Performance')].join(' - ');
  }

  return [t('Summary'), t('Performance')].join(' - ');
}

function generateEventView({
  location,
  organization,
  transactionName,
}: {
  location: Location;
  organization: Organization;
  transactionName: string;
}): EventView {
  // Use the user supplied query but overwrite any transaction or event type
  // conditions they applied.

  const query = decodeScalar(location.query.query, '');
  const conditions = new MutableSearch(query);

  const usingOTel = organization.features.includes('performance-core-otel-support');
  if (usingOTel) {
    conditions.setFilterValues('is_transaction', ['true']);
    conditions.setFilterValues(
      'transaction.method',
      conditions.getFilterValues('http.method')
    );
    conditions.removeFilter('http.method');
  } else {
    conditions.setFilterValues('event.type', ['transaction']);
  }
  conditions.setFilterValues('transaction', [transactionName]);

  Object.keys(conditions.filters).forEach(field => {
    if (isAggregateField(field)) {
      conditions.removeFilter(field);
    }
  });

  const fields = usingOTel
    ? [
        'id',
        'user.email',
        'user.username',
        'user.id',
        'user.ip',
        'span.duration',
        'trace',
        'timestamp',
      ]
    : ['id', 'user.display', 'transaction.duration', 'trace', 'timestamp'];

  return EventView.fromNewQueryWithLocation(
    {
      id: undefined,
      version: 2,
      name: transactionName,
      fields,
      query: conditions.formatString(),
      projects: [],
      dataset: usingOTel ? DiscoverDatasets.SPANS_EAP_RPC : undefined,
    },
    location
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
  eventView: EventView
): EventView {
  // const vitals = VITAL_GROUPS.map(({vitals: vs}) => vs).reduce((keys: WebVital[], vs) => {
  //   vs.forEach(vital => keys.push(vital));
  //   return keys;
  // }, []);

  const totalsColumns: QueryFieldValue[] = [
    {
      kind: 'function',
      function: ['p95', '', undefined, undefined],
    },
    {
      kind: 'function',
      function: ['count_unique', 'user', undefined, undefined],
    },
    // {
    //   kind: 'function',
    //   function: ['failure_rate', '', undefined, undefined],
    // },
    // {
    //   kind: 'function',
    //   function: ['tpm', '', undefined, undefined],
    // },
    // {
    //   kind: 'function',
    //   function: ['count_miserable', 'user', undefined, undefined],
    // },
    // {
    //   kind: 'function',
    //   function: ['user_misery', '', undefined, undefined],
    // },
    // {
    //   kind: 'function',
    //   function: ['apdex', '', undefined, undefined],
    // },
    // {
    //   kind: 'function',
    //   function: ['sum', 'transaction.duration', undefined, undefined],
    // },
  ];

  return eventView.withColumns([
    ...totalsColumns,
    // ...vitals.map(
    //   vital =>
    //     ({
    //       kind: 'function',
    //       function: ['percentile', vital, VITAL_PERCENTILE.toString(), undefined],
    //     }) as Column
    // ),
  ]);
}

export default withPageFilters(withProjects(withOrganization(TransactionOverview)));
