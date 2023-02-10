import {useEffect} from 'react';
import {browserHistory} from 'react-router';
import {Location} from 'history';

import {loadOrganizationTags} from 'sentry/actionCreators/tags';
import {t} from 'sentry/locale';
import {Organization, PageFilters, Project} from 'sentry/types';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import {useDiscoverQuery} from 'sentry/utils/discover/discoverQuery';
import EventView from 'sentry/utils/discover/eventView';
import {Column, isAggregateField, QueryFieldValue} from 'sentry/utils/discover/fields';
import {WebVital} from 'sentry/utils/fields';
import {
  MEPSettingProvider,
  useMEPSettingContext,
} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';
import {removeHistogramQueryStrings} from 'sentry/utils/performance/histogram';
import {decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import useApi from 'sentry/utils/useApi';
import withOrganization from 'sentry/utils/withOrganization';
import withPageFilters from 'sentry/utils/withPageFilters';
import withProjects from 'sentry/utils/withProjects';
import {
  canUseMetricsInTransactionSummary,
  getTransactionMEPParamsIfApplicable,
} from 'sentry/views/performance/transactionSummary/transactionOverview/utils';

import {addRoutePerformanceContext} from '../../utils';
import {
  decodeFilterFromLocation,
  filterToLocationQuery,
  SpanOperationBreakdownFilter,
} from '../filter';
import PageLayout, {ChildProps} from '../pageLayout';
import Tab from '../tabs';
import {
  PERCENTILE as VITAL_PERCENTILE,
  VITAL_GROUPS,
} from '../transactionVitals/constants';

import {ZOOM_END, ZOOM_START} from './latencyChart/utils';
import SummaryContent from './content';

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
    trackAdvancedAnalyticsEvent('performance_views.transaction_summary.view', {
      organization,
    });
  }, [selection, organization, api]);

  return (
    <MEPSettingProvider>
      <PageLayout
        location={location}
        organization={organization}
        projects={projects}
        tab={Tab.TransactionSummary}
        getDocumentTitle={getDocumentTitle}
        generateEventView={generateEventView}
        childComponent={OverviewContentWrapper}
      />
    </MEPSettingProvider>
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

  const mepSetting = useMEPSettingContext();
  const queryExtras = getTransactionMEPParamsIfApplicable(
    mepSetting,
    organization,
    location
  );

  const queryData = useDiscoverQuery({
    eventView: getTotalsEventView(organization, eventView),
    orgSlug: organization.slug,
    location,
    transactionThreshold,
    transactionThresholdMetric,
    referrer: 'api.performance.transaction-summary',
    queryExtras,
  });

  const unfilteredQueryExtras = getTransactionMEPParamsIfApplicable(
    mepSetting,
    organization,
    location,
    true
  );

  const additionalQueryData = useDiscoverQuery({
    eventView: getUnfilteredTotalsEventView(eventView, location),
    orgSlug: organization.slug,
    location,
    transactionThreshold,
    transactionThresholdMetric,
    referrer: 'api.performance.transaction-summary',
    queryExtras: unfilteredQueryExtras,
  });

  const {data: tableData, isLoading, error} = queryData;
  const {data: unfilteredTableData} = additionalQueryData;

  const spanOperationBreakdownFilter = decodeFilterFromLocation(location);

  const onChangeFilter = (newFilter: SpanOperationBreakdownFilter) => {
    trackAdvancedAnalyticsEvent('performance_views.filter_dropdown.selection', {
      organization,
      action: newFilter as string,
    });

    const nextQuery: Location['query'] = {
      ...removeHistogramQueryStrings(location, [ZOOM_START, ZOOM_END]),
      ...filterToLocationQuery(newFilter),
    };

    if (newFilter === SpanOperationBreakdownFilter.None) {
      delete nextQuery.breakdown;
    }

    browserHistory.push({
      pathname: location.pathname,
      query: nextQuery,
    });
  };

  const totals: TotalValues | null =
    (tableData?.data?.[0] as {[k: string]: number}) ?? null;

  const unfilteredTotals: TotalValues | null = canUseMetricsInTransactionSummary(
    organization
  )
    ? (unfilteredTableData?.data?.[0] as {[k: string]: number}) ?? null
    : null;

  return (
    <SummaryContent
      location={location}
      organization={organization}
      eventView={eventView}
      projectId={projectId}
      transactionName={transactionName}
      isLoading={isLoading}
      error={error}
      totalValues={totals}
      onChangeFilter={onChangeFilter}
      spanOperationBreakdownFilter={spanOperationBreakdownFilter}
      unfilteredTotalValues={unfilteredTotals}
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

  conditions.setFilterValues('event.type', ['transaction']);
  conditions.setFilterValues('transaction', [transactionName]);

  Object.keys(conditions.filters).forEach(field => {
    if (isAggregateField(field)) {
      conditions.removeFilter(field);
    }
  });

  const fields = ['id', 'user.display', 'transaction.duration', 'trace', 'timestamp'];

  return EventView.fromNewQueryWithLocation(
    {
      id: undefined,
      version: 2,
      name: transactionName,
      fields,
      query: conditions.formatString(),
      projects: [],
    },
    location
  );
}

function getUnfilteredTotalsEventView(
  eventView: EventView,
  location: Location
): EventView {
  const totalsColumns: QueryFieldValue[] = [
    {
      kind: 'function',
      function: ['tpm', '', undefined, undefined],
    },
    {
      kind: 'function',
      function: ['count', '', undefined, undefined],
    },
  ];

  const transactionName = decodeScalar(location.query.transaction);
  const conditions = new MutableSearch('');

  conditions.setFilterValues('event.type', ['transaction']);
  if (transactionName) {
    conditions.setFilterValues('transaction', [transactionName]);
  }

  const unfilteredEventView = eventView.withColumns([...totalsColumns]);
  unfilteredEventView.query = conditions.formatString();

  return unfilteredEventView;
}

function getTotalsEventView(
  _organization: Organization,
  eventView: EventView
): EventView {
  const vitals = VITAL_GROUPS.map(({vitals: vs}) => vs).reduce((keys: WebVital[], vs) => {
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
      function: ['count', '', undefined, undefined],
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
  ];

  return eventView.withColumns([
    ...totalsColumns,
    ...vitals.map(
      vital =>
        ({
          kind: 'function',
          function: ['percentile', vital, VITAL_PERCENTILE.toString(), undefined],
        } as Column)
    ),
  ]);
}

export default withPageFilters(withProjects(withOrganization(TransactionOverview)));
