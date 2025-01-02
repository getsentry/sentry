import type {Location} from 'history';

import * as Layout from 'sentry/components/layouts/thirds';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import {browserHistory} from 'sentry/utils/browserHistory';
import DiscoverQuery from 'sentry/utils/discover/discoverQuery';
import EventView from 'sentry/utils/discover/eventView';
import {
  isAggregateField,
  SPAN_OP_BREAKDOWN_FIELDS,
  SPAN_OP_RELATIVE_BREAKDOWN_FIELD,
} from 'sentry/utils/discover/fields';
import {WebVital} from 'sentry/utils/fields';
import {removeHistogramQueryStrings} from 'sentry/utils/performance/histogram';
import {decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import withOrganization from 'sentry/utils/withOrganization';
import withProjects from 'sentry/utils/withProjects';

import {
  decodeFilterFromLocation,
  filterToLocationQuery,
  SpanOperationBreakdownFilter,
} from '../filter';
import type {ChildProps} from '../pageLayout';
import PageLayout from '../pageLayout';
import Tab from '../tabs';
import {ZOOM_END, ZOOM_START} from '../transactionOverview/latencyChart/utils';

import EventsContent from './content';
import {
  decodeEventsDisplayFilterFromLocation,
  EventsDisplayFilterName,
  filterEventsDisplayToLocationQuery,
  getEventsFilterOptions,
  getPercentilesEventView,
  mapPercentileValues,
} from './utils';

type PercentileValues = Record<EventsDisplayFilterName, number>;

type Props = {
  location: Location;
  organization: Organization;
  projects: Project[];
};

function TransactionEvents(props: Props) {
  const {location, organization, projects} = props;

  return (
    <PageLayout
      location={location}
      organization={organization}
      projects={projects}
      tab={Tab.EVENTS}
      getDocumentTitle={getDocumentTitle}
      generateEventView={generateEventView}
      childComponent={EventsContentWrapper}
    />
  );
}

function EventsContentWrapper(props: ChildProps) {
  const {
    location,
    organization,
    eventView,
    transactionName,
    setError,
    projectId,
    projects,
  } = props;
  const eventsDisplayFilterName = decodeEventsDisplayFilterFromLocation(location);
  const spanOperationBreakdownFilter = decodeFilterFromLocation(location);
  const webVital = getWebVital(location);

  const percentilesView = getPercentilesEventView(eventView);

  const getFilteredEventView = (percentiles: PercentileValues) => {
    const filter = getEventsFilterOptions(spanOperationBreakdownFilter, percentiles)[
      eventsDisplayFilterName
    ];
    const filteredEventView = eventView?.clone();
    if (filteredEventView && filter?.query) {
      const query = new MutableSearch(filteredEventView.query);
      filter.query.forEach(item => query.setFilterValues(item[0]!, [item[1]!]));
      filteredEventView.query = query.formatString();
    }
    return filteredEventView;
  };

  const onChangeSpanOperationBreakdownFilter = (
    newFilter: SpanOperationBreakdownFilter
  ) => {
    trackAnalytics('performance_views.transactionEvents.ops_filter_dropdown.selection', {
      organization,
      action: newFilter as string,
    });

    // Check to see if the current table sort matches the EventsDisplayFilter.
    // If it does, we can re-sort using the new SpanOperationBreakdownFilter
    const eventsFilterOptionSort = getEventsFilterOptions(spanOperationBreakdownFilter)[
      eventsDisplayFilterName
    ].sort;
    const currentSort = eventView?.sorts?.[0];
    let sortQuery: Record<string, string> = {};

    if (
      eventsFilterOptionSort?.kind === currentSort?.kind &&
      eventsFilterOptionSort?.field === currentSort?.field
    ) {
      sortQuery = filterEventsDisplayToLocationQuery(eventsDisplayFilterName, newFilter);
    }

    const nextQuery: Location['query'] = {
      ...removeHistogramQueryStrings(location, [ZOOM_START, ZOOM_END]),
      ...filterToLocationQuery(newFilter),
      ...sortQuery,
    };

    if (newFilter === SpanOperationBreakdownFilter.NONE) {
      delete nextQuery.breakdown;
    }
    browserHistory.push({
      pathname: location.pathname,
      query: nextQuery,
    });
  };

  const onChangeEventsDisplayFilter = (newFilterName: EventsDisplayFilterName) => {
    trackAnalytics(
      'performance_views.transactionEvents.display_filter_dropdown.selection',
      {
        organization,
        action: newFilterName as string,
      }
    );

    const nextQuery: Location['query'] = {
      ...removeHistogramQueryStrings(location, [ZOOM_START, ZOOM_END]),
      ...filterEventsDisplayToLocationQuery(newFilterName, spanOperationBreakdownFilter),
    };

    if (newFilterName === EventsDisplayFilterName.P100) {
      delete nextQuery.showTransaction;
    }

    browserHistory.push({
      pathname: location.pathname,
      query: nextQuery,
    });
  };

  return (
    <DiscoverQuery
      eventView={percentilesView}
      orgSlug={organization.slug}
      location={location}
      referrer="api.performance.transaction-events"
    >
      {({isLoading, tableData}) => {
        if (isLoading) {
          return (
            <Layout.Main fullWidth>
              <LoadingIndicator />
            </Layout.Main>
          );
        }

        const percentileData = tableData?.data?.[0];
        const percentiles = mapPercentileValues(percentileData);
        const filteredEventView = getFilteredEventView(percentiles);
        return (
          <EventsContent
            location={location}
            organization={organization}
            eventView={filteredEventView}
            transactionName={transactionName}
            spanOperationBreakdownFilter={spanOperationBreakdownFilter}
            onChangeSpanOperationBreakdownFilter={onChangeSpanOperationBreakdownFilter}
            eventsDisplayFilterName={eventsDisplayFilterName}
            onChangeEventsDisplayFilter={onChangeEventsDisplayFilter}
            percentileValues={percentiles}
            projectId={projectId}
            projects={projects}
            webVital={webVital}
            setError={setError}
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
    return [String(transactionName).trim(), t('Events')].join(' \u2014 ');
  }

  return [t('Summary'), t('Events')].join(' \u2014 ');
}

function getWebVital(location: Location): WebVital | undefined {
  const webVital = decodeScalar(location.query.webVital, '') as WebVital;
  if (Object.values(WebVital).includes(webVital)) {
    return webVital;
  }
  return undefined;
}

function generateEventView({
  location,
  transactionName,
}: {
  location: Location;
  organization: Organization;
  transactionName: string;
}): EventView {
  const query = decodeScalar(location.query.query, '');
  const conditions = new MutableSearch(query);

  conditions.setFilterValues('event.type', ['transaction']);
  conditions.setFilterValues('transaction', [transactionName]);

  Object.keys(conditions.filters).forEach(field => {
    if (isAggregateField(field)) {
      conditions.removeFilter(field);
    }
  });

  // Default fields for relative span view
  const fields = [
    'id',
    'user.display',
    SPAN_OP_RELATIVE_BREAKDOWN_FIELD,
    'transaction.duration',
    'trace',
    'timestamp',
  ];
  const breakdown = decodeFilterFromLocation(location);
  if (breakdown !== SpanOperationBreakdownFilter.NONE) {
    fields.splice(2, 1, `spans.${breakdown}`);
  } else {
    fields.push(...SPAN_OP_BREAKDOWN_FIELDS);
  }
  const webVital = getWebVital(location);
  if (webVital) {
    fields.splice(3, 0, webVital);
  }

  return EventView.fromNewQueryWithLocation(
    {
      id: undefined,
      version: 2,
      name: transactionName,
      fields,
      query: conditions.formatString(),
      projects: [],
      orderby: decodeScalar(location.query.sort, '-timestamp'),
    },
    location
  );
}

export default withProjects(withOrganization(TransactionEvents));
