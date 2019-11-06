import React from 'react';
import {Location} from 'history';
import {browserHistory} from 'react-router';
import styled from 'react-emotion';

import {Client} from 'app/api';
import {Organization} from 'app/types';
import withApi from 'app/utils/withApi';

import Pagination from 'app/components/pagination';
import {fetchOrganizationTags} from 'app/actionCreators/tags';

import {DEFAULT_EVENT_VIEW_V1} from '../data';
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
    error: null,

    pageLinks: null,
    tableData: null,
    tagKeys: null,
  };

  componentDidMount() {
    const {location, eventView} = this.props;

    if (!eventView.isValid()) {
      const nextEventView = EventView.fromEventViewv1(DEFAULT_EVENT_VIEW_V1);

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

    this.setState({isLoading: true});

    this.props.api
      .requestPromise(url, {
        method: 'GET',
        includeAllArgs: true,
        query: eventView.getEventsAPIPayload(location),
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

    fetchOrganizationTags(this.props.api, organization.slug)
      .then(tags => {
        this.setState({tagKeys: tags.map(({key}) => key)});
      })
      .catch(() => {
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
`;
