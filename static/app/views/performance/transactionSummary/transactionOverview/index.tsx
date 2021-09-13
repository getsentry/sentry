import {useEffect} from 'react';
import {browserHistory} from 'react-router';
import {Location} from 'history';

import {loadOrganizationTags} from 'app/actionCreators/tags';
import {Client} from 'app/api';
import {t} from 'app/locale';
import {GlobalSelection, Organization, Project} from 'app/types';
import {trackAnalyticsEvent} from 'app/utils/analytics';
import DiscoverQuery from 'app/utils/discover/discoverQuery';
import EventView from 'app/utils/discover/eventView';
import {
  Column,
  isAggregateField,
  QueryFieldValue,
  WebVital,
} from 'app/utils/discover/fields';
import {removeHistogramQueryStrings} from 'app/utils/performance/histogram';
import {decodeScalar} from 'app/utils/queryString';
import {MutableSearch} from 'app/utils/tokenizeSearch';
import withApi from 'app/utils/withApi';
import withGlobalSelection from 'app/utils/withGlobalSelection';
import withOrganization from 'app/utils/withOrganization';
import withProjects from 'app/utils/withProjects';

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

import SummaryContent from './content';
import {ZOOM_END, ZOOM_START} from './latencyChart';

// Used to cast the totals request to numbers
// as React.ReactText
type TotalValues = Record<string, number>;

type Props = {
  api: Client;
  location: Location;
  selection: GlobalSelection;
  organization: Organization;
  projects: Project[];
};

function TransactionOverview(props: Props) {
  const {api, location, selection, organization, projects} = props;

  useEffect(() => {
    loadOrganizationTags(api, organization.slug, selection);
    addRoutePerformanceContext(selection);
  }, [selection]);

  return (
    <PageLayout
      location={location}
      organization={organization}
      projects={projects}
      tab={Tab.TransactionSummary}
      getDocumentTitle={getDocumentTitle}
      generateEventView={generateEventView}
      childComponent={OverviewContentWrapper}
    />
  );
}

function OverviewContentWrapper(props: ChildProps) {
  const {
    location,
    organization,
    eventView,
    transactionName,
    transactionThreshold,
    transactionThresholdMetric,
  } = props;

  const spanOperationBreakdownFilter = decodeFilterFromLocation(location);

  const totalsView = getTotalsEventView(organization, eventView);

  const onChangeFilter = (newFilter: SpanOperationBreakdownFilter) => {
    trackAnalyticsEvent({
      eventName: 'Performance Views: Filter Dropdown',
      eventKey: 'performance_views.filter_dropdown.selection',
      organization_id: parseInt(organization.id, 10),
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

  return (
    <DiscoverQuery
      eventView={totalsView}
      orgSlug={organization.slug}
      location={location}
      transactionThreshold={transactionThreshold}
      transactionThresholdMetric={transactionThresholdMetric}
      referrer="api.performance.transaction-summary"
    >
      {({isLoading, error, tableData}) => {
        const totals: TotalValues | null = tableData?.data?.[0] ?? null;
        return (
          <SummaryContent
            location={location}
            organization={organization}
            eventView={eventView}
            transactionName={transactionName}
            isLoading={isLoading}
            error={error}
            totalValues={totals}
            onChangeFilter={onChangeFilter}
            spanOperationBreakdownFilter={spanOperationBreakdownFilter}
          />
        );
      }}
    </DiscoverQuery>
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

function generateEventView(location: Location, transactionName: string): EventView {
  // Use the user supplied query but overwrite any transaction or event type
  // conditions they applied.
  const query = decodeScalar(location.query.query, '');
  const conditions = new MutableSearch(query);
  conditions
    .setFilterValues('event.type', ['transaction'])
    .setFilterValues('transaction', [transactionName]);

  Object.keys(conditions.filters).forEach(field => {
    if (isAggregateField(field)) conditions.removeFilter(field);
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

export default withApi(
  withGlobalSelection(withProjects(withOrganization(TransactionOverview)))
);
