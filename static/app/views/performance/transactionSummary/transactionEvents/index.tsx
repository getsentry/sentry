import type {Location} from 'history';

import * as Layout from 'sentry/components/layouts/thirds';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {trackAnalytics} from 'sentry/utils/analytics';
import {DiscoverQuery} from 'sentry/utils/discover/discoverQuery';
import {removeHistogramQueryStrings} from 'sentry/utils/performance/histogram';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useSpans} from 'sentry/views/insights/common/queries/useDiscover';
import {useTransactionSummaryEAP} from 'sentry/views/performance/eap/useTransactionSummaryEAP';
import {SEGMENT_SPANS_CURSOR} from 'sentry/views/performance/eap/utils';
import {
  decodeFilterFromLocation,
  filterToLocationQuery,
  SpanOperationBreakdownFilter,
} from 'sentry/views/performance/transactionSummary/filter';
import {
  ZOOM_END,
  ZOOM_START,
} from 'sentry/views/performance/transactionSummary/transactionOverview/latencyChart/utils';
import {useTransactionSummaryContext} from 'sentry/views/performance/transactionSummary/transactionSummaryContext';

import {EventsContent} from './content';
import {
  decodeEventsDisplayFilterFromLocation,
  EAP_PERCENTILE_FIELDS,
  EventsDisplayFilterName,
  filterEventsDisplayToEAPLocationQuery,
  filterEventsDisplayToLocationQuery,
  getEventsFilterOptions,
  getPercentilesEventView,
  getWebVital,
  mapEAPPercentileValues,
  mapPercentileValues,
} from './utils';

type PercentileValues = Record<EventsDisplayFilterName, number>;

function TransactionEvents() {
  const {organization, eventView, transactionName, setError, projectId, projects} =
    useTransactionSummaryContext();

  const navigate = useNavigate();
  const location = useLocation();
  const shouldUseEAP = useTransactionSummaryEAP();
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
    newFilter: SpanOperationBreakdownFilter | undefined
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
      sortQuery = newFilter
        ? filterEventsDisplayToLocationQuery(eventsDisplayFilterName, newFilter)
        : {};
    }

    const nextQuery: Location['query'] = {
      ...removeHistogramQueryStrings(location, [ZOOM_START, ZOOM_END]),
      ...filterToLocationQuery(newFilter),
      ...sortQuery,
    };

    if (newFilter === SpanOperationBreakdownFilter.NONE) {
      delete nextQuery.breakdown;
    }
    navigate({
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

    navigate({
      pathname: location.pathname,
      query: nextQuery,
    });
  };

  if (shouldUseEAP) {
    return (
      <EAPTransactionEvents
        onChangeSpanOperationBreakdownFilter={onChangeSpanOperationBreakdownFilter}
      />
    );
  }

  return (
    <DiscoverQuery
      eventView={percentilesView}
      orgSlug={organization.slug}
      location={location}
      referrer="api.insights.transaction-events"
    >
      {({isLoading, tableData}) => {
        if (isLoading) {
          return (
            <Layout.Main width="full">
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

function EAPTransactionEvents({
  onChangeSpanOperationBreakdownFilter,
}: {
  onChangeSpanOperationBreakdownFilter: (
    newFilter: SpanOperationBreakdownFilter | undefined
  ) => void;
}) {
  const {organization, eventView, transactionName, setError, projectId, projects} =
    useTransactionSummaryContext();
  const {selection} = usePageFilters();
  const location = useLocation();
  const navigate = useNavigate();
  const eventsDisplayFilterName = decodeEventsDisplayFilterFromLocation(location);
  const spanOperationBreakdownFilter = decodeFilterFromLocation(location);
  const webVital = getWebVital(location);

  const percentileQuery = new MutableSearch('');
  percentileQuery.setFilterValues('is_transaction', ['true']);
  percentileQuery.setFilterValues('transaction', [transactionName]);

  const {data: percentileData} = useSpans(
    {
      search: percentileQuery,
      fields: [...EAP_PERCENTILE_FIELDS],
      pageFilters: selection,
    },
    'api.insights.transaction-events-percentiles'
  );

  const percentileValues = mapEAPPercentileValues(percentileData);

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
      ...filterEventsDisplayToEAPLocationQuery(newFilterName),
      [SEGMENT_SPANS_CURSOR]: undefined,
    };

    if (newFilterName === EventsDisplayFilterName.P100) {
      delete nextQuery.showTransactions;
    }

    navigate({
      pathname: location.pathname,
      query: nextQuery,
    });
  };

  return (
    <EventsContent
      location={location}
      organization={organization}
      eventView={eventView}
      transactionName={transactionName}
      spanOperationBreakdownFilter={spanOperationBreakdownFilter}
      onChangeSpanOperationBreakdownFilter={onChangeSpanOperationBreakdownFilter}
      eventsDisplayFilterName={eventsDisplayFilterName}
      onChangeEventsDisplayFilter={onChangeEventsDisplayFilter}
      percentileValues={percentileValues}
      projectId={projectId}
      projects={projects}
      webVital={webVital}
      setError={setError}
    />
  );
}

export default TransactionEvents;
