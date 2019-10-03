import React from 'react';
import {Location} from 'history';
import {browserHistory} from 'react-router';
import styled from 'react-emotion';

import {Client} from 'app/api';
import {Organization} from 'app/types';
import withApi from 'app/utils/withApi';

import Pagination from 'app/components/pagination';

import {DEFAULT_EVENT_VIEW_V1} from '../data';
import EventView from '../eventView';
import TableView from './tableView';
import {TableData} from './types';

type TableProps = {
  api: Client;
  location: Location;
  organization: Organization;
};
type TableState = {
  isLoading: boolean;
  error: null | string;

  eventView: EventView;
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
  static getDerivedStateFromProps(props: TableProps, state: TableState): TableState {
    return {
      ...state,
      eventView: EventView.fromLocation(props.location),
    };
  }

  state: TableState = {
    isLoading: true,
    error: null,

    eventView: EventView.fromLocation(this.props.location),
    pageLinks: null,

    tableData: null,
  };

  componentDidMount() {
    const {location} = this.props;

    if (!this.state.eventView.isValid()) {
      const nextEventView = EventView.fromEventViewv1(DEFAULT_EVENT_VIEW_V1);

      browserHistory.replace({
        pathname: location.pathname,
        query: {
          ...location.query,
          ...nextEventView.generateQueryStringObject(),
        },
      });
      return;
    }

    this.fetchData();
  }

  componentDidUpdate(prevProps) {
    if (
      this.props.location !== prevProps.location ||
      this.props.location.query !== prevProps.location.query ||
      this.props.location.query.fieldnames !== prevProps.location.query.fieldnames ||
      this.props.location.query.field !== prevProps.location.query.field ||
      this.props.location.query.sort !== prevProps.location.query.sort
    ) {
      this.fetchData();
    }
  }

  fetchData = () => {
    const {organization, location} = this.props;
    const url = `/organizations/${organization.slug}/eventsv2/`;

    this.setState({isLoading: true});

    this.props.api
      .requestPromise(url, {
        method: 'GET',
        includeAllArgs: true,
        query: this.state.eventView.getEventsAPIPayload(location),
      })
      .then(([data, _, jqXHR]) => {
        this.setState(prevState => {
          return {
            isLoading: false,
            error: null,
            pageLinks: jqXHR ? jqXHR.getResponseHeader('Link') : prevState.pageLinks,
            tableData: data,
          };
        });
      })
      .catch(err => {
        this.setState({
          isLoading: false,
          error: err.responseJSON.detail,
        });
      });
  };

  render() {
    const {pageLinks, eventView, tableData, isLoading, error} = this.state;

    return (
      <Container>
        <TableView
          {...this.props}
          isLoading={isLoading}
          error={error}
          eventView={eventView}
          tableData={tableData}
        />
        <Pagination pageLinks={pageLinks} />
      </Container>
    );
  }
}

export default withApi<TableProps>(Table);

const Container = styled('div')`
  min-width: 0;
  overflow: hidden;
`;
