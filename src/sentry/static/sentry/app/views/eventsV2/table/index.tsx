import React from 'react';
import {Location} from 'history';
import {browserHistory} from 'react-router';
import styled from 'react-emotion';

import {Client} from 'app/api';
import space from 'app/styles/space';
import {Organization} from 'app/types';
import withApi from 'app/utils/withApi';

import Pagination from 'app/components/pagination';
import {fetchOrganizationTags} from 'app/actionCreators/tags';

import {DEFAULT_EVENT_VIEW} from '../data';
import EventView, {isAPIPayloadSimilar} from '../eventView';
import TableView from './tableView';
import {TableData} from './types';

type TableProps = {
  api: Client;
  location: Location;
  eventView: EventView;
  organization: Organization;
};
type TableState = {
  isLoading: boolean;
  tableFetchID: symbol | undefined;
  orgTagsFetchID: symbol | undefined;
  error: null | string;

  pageLinks: null | string;

  tableData: TableData | null | undefined;
  tagKeys: null | string[];
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
    orgTagsFetchID: undefined,
    error: null,

    pageLinks: null,
    tableData: null,
    tagKeys: null,
  };

  componentDidMount() {
    const {location, eventView} = this.props;

    if (!eventView.isValid()) {
      const nextEventView = EventView.fromNewQueryWithLocation(
        DEFAULT_EVENT_VIEW,
        location
      );

      browserHistory.replace({
        pathname: location.pathname,
        query: nextEventView.generateQueryStringObject(),
      });
      return;
    }

    this.fetchData();
  }

  componentDidUpdate(prevProps: TableProps) {
    if (!this.state.isLoading && this.shouldRefetchData(prevProps)) {
      this.fetchData();
    }
  }

  shouldRefetchData = (prevProps: TableProps): boolean => {
    const thisAPIPayload = this.props.eventView.getEventsAPIPayload(this.props.location);
    const otherAPIPayload = prevProps.eventView.getEventsAPIPayload(prevProps.location);

    return !isAPIPayloadSimilar(thisAPIPayload, otherAPIPayload);
  };

  fetchData = () => {
    const {eventView, organization, location} = this.props;
    const url = `/organizations/${organization.slug}/eventsv2/`;

    const tableFetchID = Symbol('tableFetchID');
    const orgTagsFetchID = Symbol('orgTagsFetchID');

    this.setState({isLoading: true, tableFetchID, orgTagsFetchID});

    this.props.api
      .requestPromise(url, {
        method: 'GET',
        includeAllArgs: true,
        query: eventView.getEventsAPIPayload(location),
      })
      .then(([data, _, jqXHR]) => {
        if (this.state.tableFetchID !== tableFetchID) {
          // invariant: a different request was initiated after this request
          return;
        }

        this.setState(prevState => {
          return {
            isLoading: false,
            tableFetchID: undefined,
            error: null,
            pageLinks: jqXHR ? jqXHR.getResponseHeader('Link') : prevState.pageLinks,
            tableData: data,
          };
        });
      })
      .catch(err => {
        this.setState({
          isLoading: false,
          tableFetchID: undefined,
          error: err.responseJSON.detail,
          pageLinks: null,
          tableData: null,
        });
      });

    fetchOrganizationTags(this.props.api, organization.slug)
      .then(tags => {
        if (this.state.orgTagsFetchID !== orgTagsFetchID) {
          // invariant: a different request was initiated after this request
          return;
        }

        this.setState({tagKeys: tags.map(({key}) => key), orgTagsFetchID: undefined});
      })
      .catch(() => {
        this.setState({orgTagsFetchID: undefined});
        // Do nothing.
      });
  };

  render() {
    const {eventView} = this.props;
    const {pageLinks, tableData, tagKeys, isLoading, error} = this.state;

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

export default withApi<TableProps>(Table);

const Container = styled('div')`
  min-width: 0;
  overflow: hidden;
  margin-top: ${space(1.5)};
`;
