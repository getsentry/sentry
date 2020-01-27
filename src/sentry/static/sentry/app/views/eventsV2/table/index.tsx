import React from 'react';
import {Location} from 'history';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';

import {Client} from 'app/api';
import space from 'app/styles/space';
import {Organization, Tag} from 'app/types';
import withApi from 'app/utils/withApi';
import withTags from 'app/utils/withTags';
import Pagination from 'app/components/pagination';

import {DEFAULT_EVENT_VIEW} from '../data';
import EventView, {isAPIPayloadSimilar} from '../eventView';
import TableView from './tableView';
import {TableData} from './types';

type TableProps = {
  api: Client;
  location: Location;
  eventView: EventView;
  organization: Organization;
  tags: {[key: string]: Tag};
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
    if (!this.props.eventView.isValid()) {
      this.goToAllEvents();
      return;
    }

    this.fetchData();
  }

  componentDidUpdate(prevProps: TableProps) {
    if (!this.state.isLoading && this.shouldRefetchData(prevProps)) {
      this.fetchData();
    }
    if (!this.props.eventView.isValid()) {
      this.goToAllEvents();
      return;
    }
  }

  goToAllEvents() {
    const {location, organization} = this.props;
    const nextEventView = EventView.fromNewQueryWithLocation(
      DEFAULT_EVENT_VIEW,
      location
    );

    browserHistory.replace(nextEventView.getResultsViewUrlTarget(organization.slug));
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

    this.setState({isLoading: true, tableFetchID});

    const apiPayload = eventView.getEventsAPIPayload(location);

    this.props.api
      .requestPromise(url, {
        method: 'GET',
        includeAllArgs: true,
        query: apiPayload,
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
  margin-top: ${space(1.5)};
`;
