import React from 'react';
import {Location} from 'history';
import styled from '@emotion/styled';

import {Organization} from 'app/types';
import {Client} from 'app/api';
import withApi from 'app/utils/withApi';
import space from 'app/styles/space';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import EventView, {isAPIPayloadSimilar} from 'app/views/eventsV2/eventView';
import {TableData} from 'app/views/eventsV2/table/types';
import {ContentBox, HeaderBox} from 'app/views/eventsV2/styles';
import Tags from 'app/views/eventsV2/tags';

import SummaryContentTable from './table';
import Breadcrumb from './breadcrumb';
import UserStats from './user_stats';

const TOP_SLOWEST_TRANSACTIONS = 5;

type Props = {
  api: Client;
  location: Location;
  eventView: EventView;
  transactionName: string;
  organization: Organization;
};

type State = {
  isLoading: boolean;
  tableFetchID: symbol | undefined;
  error: null | string;
  tableData: TableData | null | undefined;
};

class SummaryContent extends React.Component<Props, State> {
  state: State = {
    isLoading: true,
    tableFetchID: undefined,
    error: null,

    tableData: null,
  };

  componentDidMount() {
    this.fetchData();
  }

  componentDidUpdate(prevProps: Props) {
    // Reload data if we aren't already loading, or if we've moved
    // from an invalid view state to a valid one.
    if (
      (!this.state.isLoading && this.shouldRefetchData(prevProps)) ||
      (prevProps.eventView.isValid() === false && this.props.eventView.isValid())
    ) {
      this.fetchData();
    }
  }

  shouldRefetchData = (prevProps: Props): boolean => {
    const thisAPIPayload = this.props.eventView.getEventsAPIPayload(this.props.location);
    const otherAPIPayload = prevProps.eventView.getEventsAPIPayload(prevProps.location);

    return !isAPIPayloadSimilar(thisAPIPayload, otherAPIPayload);
  };

  fetchData = () => {
    const {eventView, organization, location} = this.props;

    if (!eventView.isValid()) {
      return;
    }

    const url = `/organizations/${organization.slug}/eventsv2/`;
    const tableFetchID = Symbol('tableFetchID');
    const apiPayload = eventView.getEventsAPIPayload(location);

    this.setState({isLoading: true, tableFetchID});

    this.props.api
      .requestPromise(url, {
        method: 'GET',
        includeAllArgs: true,
        query: {
          ...apiPayload,
          per_page: TOP_SLOWEST_TRANSACTIONS,
        },
      })
      .then(([data, _, _jqXHR]) => {
        if (this.state.tableFetchID !== tableFetchID) {
          // invariant: a different request was initiated after this request
          return;
        }

        this.setState({
          isLoading: false,
          tableFetchID: undefined,
          error: null,
          tableData: data,
        });
      })
      .catch(err => {
        this.setState({
          isLoading: false,
          tableFetchID: undefined,
          error: err.responseJSON.detail,
          tableData: null,
        });
      });
  };

  render() {
    const {transactionName, location, eventView, organization} = this.props;

    return (
      <React.Fragment>
        <HeaderBox>
          <div>
            <Breadcrumb
              organization={organization}
              location={location}
              eventView={eventView}
              transactionName={transactionName}
            />
          </div>
          <TransactionName transactionName={transactionName} />
        </HeaderBox>
        <ContentBox>
          <SummaryContentTable
            organization={organization}
            location={location}
            eventView={eventView}
            tableData={this.state.tableData}
            isLoading={this.state.isLoading}
          />
          <Side>
            <UserStats
              organization={organization}
              location={location}
              eventView={eventView}
            />
            <Tags
              totalValues={null}
              eventView={eventView}
              organization={organization}
              location={location}
            />
          </Side>
        </ContentBox>
      </React.Fragment>
    );
  }
}

const TransactionName = (props: {transactionName: string}) => (
  <StyledTitleHeader>
    <StyledTitle>{props.transactionName}</StyledTitle>
  </StyledTitleHeader>
);

const StyledTitleHeader = styled('div')`
  font-size: ${p => p.theme.headerFontSize};
  color: ${p => p.theme.gray2};
  grid-column: 1/2;
  align-self: center;
  ${overflowEllipsis};
`;

const StyledTitle = styled('span')`
  color: ${p => p.theme.gray4};
  margin-right: ${space(1)};
`;

const Side = styled('div')`
  grid-column: 2/3;
`;

export default withApi(SummaryContent);
