import React from 'react';
import {Location} from 'history';
import styled from '@emotion/styled';

import {Client} from 'app/api';
import {t} from 'app/locale';
import {Organization, Tag} from 'app/types';
import {metric} from 'app/utils/analytics';
import withApi from 'app/utils/withApi';
import withTags from 'app/utils/withTags';
import Pagination from 'app/components/pagination';
import EventView, {isAPIPayloadSimilar} from 'app/utils/discover/eventView';

import TableView from './tableView';
import {TableData} from './types';

type TableProps = {
  api: Client;
  location: Location;
  eventView: EventView;
  organization: Organization;
  tags: {[key: string]: Tag};
  setError: (msg: string) => void;
  title: string;
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
class Table extends React.PureComponent<TableProps, TableState> {
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
      (prevProps.eventView.isValid() === false && this.props.eventView.isValid())
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
    const {eventView, organization, location, setError} = this.props;

    if (!eventView.isValid()) {
      return;
    }
    const url = `/organizations/${organization.slug}/eventsv2/`;
    const tableFetchID = Symbol('tableFetchID');
    const apiPayload = eventView.getEventsAPIPayload(location);
    setError('');

    this.setState({isLoading: true, tableFetchID});
    metric.mark({name: `discover-events-start-${apiPayload.query}`});

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
        setError(message);
      });
  };

  render() {
    const {eventView, tags} = this.props;
    const {pageLinks, tableData, isLoading, error} = this.state;
    const tagKeys = Object.values(tags).map(({key}) => key);

    return (
      <Container>
        <TableView
          {...this.props}
          isLoading={isLoading}
          error={error}
          eventView={eventView}
          tableData={tableData}
          tagKeys={tagKeys}
        />
        <Pagination pageLinks={pageLinks} />
      </Container>
    );
  }
}

export default withApi(withTags(Table));

const Container = styled('div')`
  min-width: 0;
  overflow: hidden;
`;
