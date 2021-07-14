import {PureComponent} from 'react';
import styled from '@emotion/styled';
import {Location} from 'history';

import {Client} from 'app/api';
import Pagination from 'app/components/pagination';
import {t} from 'app/locale';
import {Organization, TagCollection} from 'app/types';
import {metric, trackAnalyticsEvent} from 'app/utils/analytics';
import {TableData} from 'app/utils/discover/discoverQuery';
import EventView, {isAPIPayloadSimilar} from 'app/utils/discover/eventView';
import Measurements from 'app/utils/measurements/measurements';
import parseLinkHeader from 'app/utils/parseLinkHeader';
import {SPAN_OP_BREAKDOWN_FIELDS} from 'app/utils/performance/spanOperationBreakdowns/constants';
import withApi from 'app/utils/withApi';
import withTags from 'app/utils/withTags';

import TableView from './tableView';

type TableProps = {
  api: Client;
  location: Location;
  eventView: EventView;
  organization: Organization;
  showTags: boolean;
  tags: TagCollection;
  setError: (msg: string, code: number) => void;
  title: string;
  onChangeShowTags: () => void;
  confirmedQuery: boolean;
};

type TableState = {
  isLoading: boolean;
  tableFetchID: symbol | undefined;
  error: null | string;
  pageLinks: null | string;
  tableData: TableData | null | undefined;
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
  state: TableState = {
    isLoading: true,
    tableFetchID: undefined,
    error: null,

    pageLinks: null,
    tableData: null,
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
      prevProps.confirmedQuery !== this.props.confirmedQuery
    ) {
      this.fetchData();
    }
  }

  shouldRefetchData = (prevProps: TableProps): boolean => {
    const thisAPIPayload = this.props.eventView.getEventsAPIPayload(this.props.location);
    const otherAPIPayload = prevProps.eventView.getEventsAPIPayload(prevProps.location);

    return !isAPIPayloadSimilar(thisAPIPayload, otherAPIPayload);
  };

  fetchData = () => {
    const {eventView, organization, location, setError, confirmedQuery} = this.props;

    if (!eventView.isValid() || !confirmedQuery) {
      return;
    }

    // note: If the eventView has no aggregates, the endpoint will automatically add the event id in
    // the API payload response

    const url = `/organizations/${organization.slug}/eventsv2/`;
    const tableFetchID = Symbol('tableFetchID');
    const apiPayload = eventView.getEventsAPIPayload(location);
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
      .then(([data, _, jqXHR]) => {
        // We want to measure this metric regardless of whether we use the result
        metric.measure({
          name: 'app.api.discover-query',
          start: `discover-events-start-${apiPayload.query}`,
          data: {
            status: jqXHR && jqXHR.status,
          },
        });
        if (this.state.tableFetchID !== tableFetchID) {
          // invariant: a different request was initiated after this request
          return;
        }

        this.setState(prevState => ({
          isLoading: false,
          tableFetchID: undefined,
          error: null,
          pageLinks: jqXHR ? jqXHR.getResponseHeader('Link') : prevState.pageLinks,
          tableData: data,
        }));
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

        trackAnalyticsEvent({
          eventKey: 'discover_search.failed',
          eventName: 'Discover Search: Failed',
          organization_id: this.props.organization.id,
          search_type: 'events',
          search_source: 'discover_search',
          error: message,
        });

        setError(message, err.status);
      });
  };

  render() {
    const {eventView, organization, tags} = this.props;
    const {pageLinks, tableData, isLoading, error} = this.state;
    const tagKeys = Object.values(tags).map(({key}) => key);

    const isFirstPage = pageLinks
      ? parseLinkHeader(pageLinks).previous.results === false
      : false;

    return (
      <Container>
        <Measurements organization={organization}>
          {({measurements}) => {
            const measurementKeys = Object.values(measurements).map(({key}) => key);

            return (
              <TableView
                {...this.props}
                isLoading={isLoading}
                isFirstPage={isFirstPage}
                error={error}
                eventView={eventView}
                tableData={tableData}
                tagKeys={tagKeys}
                measurementKeys={measurementKeys}
                spanOperationBreakdownKeys={SPAN_OP_BREAKDOWN_FIELDS}
              />
            );
          }}
        </Measurements>
        <Pagination pageLinks={pageLinks} />
      </Container>
    );
  }
}

export default withApi(withTags(Table));

const Container = styled('div')`
  min-width: 0;
`;
