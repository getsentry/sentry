import {PureComponent} from 'react';
import styled from '@emotion/styled';
import type {Location} from 'history';

import type {EventQuery} from 'sentry/actionCreators/events';
import type {Client} from 'sentry/api';
import ErrorBoundary from 'sentry/components/errorBoundary';
import type {CursorHandler} from 'sentry/components/pagination';
import Pagination from 'sentry/components/pagination';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {metric, trackAnalytics} from 'sentry/utils/analytics';
import {CustomMeasurementsContext} from 'sentry/utils/customMeasurements/customMeasurementsContext';
import type {TableData} from 'sentry/utils/discover/discoverQuery';
import type {LocationQuery} from 'sentry/utils/discover/eventView';
import type EventView from 'sentry/utils/discover/eventView';
import {isAPIPayloadSimilar, isFieldsSimilar} from 'sentry/utils/discover/eventView';
import {SPAN_OP_BREAKDOWN_FIELDS} from 'sentry/utils/discover/fields';
import type {DiscoverDatasets, SavedQueryDatasets} from 'sentry/utils/discover/types';
import Measurements from 'sentry/utils/measurements/measurements';
import parseLinkHeader from 'sentry/utils/parseLinkHeader';
import {VisuallyCompleteWithData} from 'sentry/utils/performanceForSentry';
import withApi from 'sentry/utils/withApi';
import {hasDatasetSelector} from 'sentry/views/dashboards/utils';

import TableView from './tableView';

type TableProps = {
  api: Client;
  confirmedQuery: boolean;
  eventView: EventView;
  location: Location;
  onChangeShowTags: () => void;
  onCursor: CursorHandler;
  organization: Organization;
  setError: (msg: string, code: number) => void;
  showTags: boolean;
  title: string;
  dataset?: DiscoverDatasets;
  isHomepage?: boolean;
  queryDataset?: SavedQueryDatasets;
  setSplitDecision?: (value: SavedQueryDatasets) => void;
  setTips?: (tips: string[]) => void;
};

type TableState = {
  error: null | string;
  isLoading: boolean;
  pageLinks: null | string;
  prevView: null | EventView;
  tableData: TableData | null | undefined;
  tableFetchID: symbol | undefined;
};

/**
 * `Table` is a container element that handles 2 things
 * 1. Fetch data from source
 * 2. Handle pagination of data
 *
 * It will pass the data it fetched to `TableView`, where the state of the
 * Table is maintained and controlled
 */
class Table extends PureComponent<TableProps, TableState> {
  static getDerivedStateFromProps(
    nextProps: Readonly<TableProps>,
    prevState: TableState
  ): TableState {
    // Force loading state to be true if certain eventView props change.
    // This is because this (and the TableView) component rerenders before
    // loading state is set. In some cases, eventView changes such that
    // the custom field renderer for event id expects trace id (and throws
    // an error if trace id doesn't exist) but the table data isn't refetched
    // and loading state isn't set yet. This results in the componen crashing.
    const nextEventView = nextProps.eventView;
    const prevEventView = prevState.prevView;

    if (
      prevEventView &&
      (!isFieldsSimilar(
        nextEventView.fields.map(f => f.field),
        prevEventView.fields.map(f => f.field)
      ) ||
        nextEventView.dataset !== prevEventView.dataset)
    ) {
      return {...prevState, isLoading: true};
    }

    return prevState;
  }

  state: TableState = {
    isLoading: true,
    tableFetchID: undefined,
    error: null,

    pageLinks: null,
    tableData: null,
    prevView: null,
  };

  componentDidMount() {
    this.fetchData();
  }

  componentDidUpdate(prevProps: TableProps) {
    // Reload data if we aren't already loading, or if we've moved
    // from an invalid view state to a valid one.
    if (
      (!this.state.isLoading && this.shouldRefetchData(prevProps)) ||
      (prevProps.eventView.isValid() === false && this.props.eventView.isValid()) ||
      (prevProps.confirmedQuery !== this.props.confirmedQuery && this.didViewChange())
    ) {
      this.fetchData();
    }
  }

  didViewChange = (): boolean => {
    const {prevView} = this.state;
    const thisAPIPayload = this.props.eventView.getEventsAPIPayload(this.props.location);
    if (prevView === null) {
      return true;
    }
    const otherAPIPayload = prevView.getEventsAPIPayload(this.props.location);

    return !isAPIPayloadSimilar(thisAPIPayload, otherAPIPayload);
  };

  shouldRefetchData = (prevProps: TableProps): boolean => {
    const thisAPIPayload = this.props.eventView.getEventsAPIPayload(this.props.location);
    const otherAPIPayload = prevProps.eventView.getEventsAPIPayload(prevProps.location);

    return !isAPIPayloadSimilar(thisAPIPayload, otherAPIPayload);
  };

  fetchData = () => {
    const {
      eventView,
      organization,
      location,
      setError,
      confirmedQuery,
      setTips,
      setSplitDecision,
    } = this.props;

    if (!eventView.isValid() || !confirmedQuery) {
      return;
    }
    this.setState({prevView: eventView, isLoading: true});

    // note: If the eventView has no aggregates, the endpoint will automatically add the event id in
    // the API payload response

    const url = `/organizations/${organization.slug}/events/`;
    const tableFetchID = Symbol('tableFetchID');

    const apiPayload = eventView.getEventsAPIPayload(location) as LocationQuery &
      EventQuery;

    // We are now routing to the trace view on clicking event ids. Therefore, we need the trace slug associated to the event id.
    // Note: Event ID or 'id' is added to the fields in the API payload response by default for all non-aggregate queries.
    if (!eventView.hasAggregateField() || apiPayload.field.includes('id')) {
      apiPayload.field.push('trace');

      // We need to include the event.type field because we want to
      // route to issue details for error and default event types.
      if (!hasDatasetSelector(organization)) {
        apiPayload.field.push('event.type');
      }
    }

    // To generate the target url for TRACE ID and EVENT ID links we always include a timestamp,
    // to speed up the trace endpoint. Adding timestamp for the non-aggregate case and
    // max(timestamp) for the aggregate case as fields, to accomodate this.
    if (
      eventView.hasAggregateField() &&
      apiPayload.field.includes('trace') &&
      !apiPayload.field.includes('max(timestamp)') &&
      !apiPayload.field.includes('timestamp')
    ) {
      apiPayload.field.push('max(timestamp)');
    } else if (
      apiPayload.field.includes('trace') &&
      !apiPayload.field.includes('timestamp')
    ) {
      apiPayload.field.push('timestamp');
    }

    if (hasDatasetSelector(organization) && eventView.id) {
      apiPayload.discoverSavedQueryId = eventView.id;
    }

    apiPayload.referrer = 'api.discover.query-table';

    setError('', 200);

    this.setState({isLoading: true, tableFetchID});
    metric.mark({name: `discover-events-start-${apiPayload.query}`});

    this.props.api.clear();
    this.props.api
      .requestPromise(url, {
        method: 'GET',
        includeAllArgs: true,
        query: apiPayload,
      })
      .then(([data, _, resp]) => {
        // We want to measure this metric regardless of whether we use the result
        metric.measure({
          name: 'app.api.discover-query',
          start: `discover-events-start-${apiPayload.query}`,
          data: {
            status: resp?.status,
          },
        });
        if (this.state.tableFetchID !== tableFetchID) {
          // invariant: a different request was initiated after this request
          return;
        }

        const {fields, ...nonFieldsMeta} = data.meta ?? {};
        // events api uses a different response format so we need to construct tableData differently
        const tableData = {
          ...data,
          meta: {...fields, ...nonFieldsMeta, fields},
        };

        trackAnalytics('discover_search.success', {
          has_results: tableData.data.length > 0,
          organization: this.props.organization,
          search_type: 'events',
          search_source: 'discover_search',
        });

        this.setState(prevState => ({
          isLoading: false,
          tableFetchID: undefined,
          error: null,
          pageLinks: resp ? resp.getResponseHeader('Link') : prevState.pageLinks,
          tableData,
        }));

        const tips: string[] = [];
        const {query, columns} = tableData?.meta?.tips ?? {};
        if (query) {
          tips.push(query);
        }
        if (columns) {
          tips.push(columns);
        }
        setTips?.(tips);
        const splitDecision = tableData?.meta?.discoverSplitDecision;
        if (splitDecision) {
          setSplitDecision?.(splitDecision);
        }
      })
      .catch(err => {
        metric.measure({
          name: 'app.api.discover-query',
          start: `discover-events-start-${apiPayload.query}`,
          data: {
            status: err.status,
          },
        });

        const message = err?.responseJSON?.detail || t('An unknown error occurred.');
        this.setState({
          isLoading: false,
          tableFetchID: undefined,
          error: message,
          pageLinks: null,
          tableData: null,
        });
        trackAnalytics('discover_search.failed', {
          organization: this.props.organization,
          search_type: 'events',
          search_source: 'discover_search',
          error: message,
        });
        setError(message, err.status);
      });
  };

  render() {
    const {eventView, onCursor, dataset, queryDataset} = this.props;
    const {pageLinks, tableData, isLoading, error} = this.state;

    const isFirstPage = pageLinks
      ? parseLinkHeader(pageLinks).previous!.results === false
      : false;

    return (
      <Container>
        <Measurements>
          {({measurements}) => {
            const measurementKeys = Object.values(measurements).map(({key}) => key);

            return (
              <CustomMeasurementsContext.Consumer>
                {contextValue => (
                  <VisuallyCompleteWithData
                    id="Discover-Table"
                    hasData={(tableData?.data?.length ?? 0) > 0}
                    isLoading={isLoading}
                  >
                    <ErrorBoundary>
                      <TableView
                        {...this.props}
                        isLoading={isLoading}
                        isFirstPage={isFirstPage}
                        error={error}
                        eventView={eventView}
                        tableData={tableData}
                        measurementKeys={measurementKeys}
                        spanOperationBreakdownKeys={SPAN_OP_BREAKDOWN_FIELDS}
                        customMeasurements={contextValue?.customMeasurements ?? undefined}
                        dataset={dataset}
                        queryDataset={queryDataset}
                      />
                    </ErrorBoundary>
                  </VisuallyCompleteWithData>
                )}
              </CustomMeasurementsContext.Consumer>
            );
          }}
        </Measurements>
        <Pagination pageLinks={pageLinks} onCursor={onCursor} />
      </Container>
    );
  }
}

export default withApi(Table);

const Container = styled('div')`
  min-width: 0;
`;
