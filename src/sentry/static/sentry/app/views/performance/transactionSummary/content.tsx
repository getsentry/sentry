import React from 'react';
import {Location} from 'history';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';
import omit from 'lodash/omit';

import {Organization} from 'app/types';
import {getParams} from 'app/components/organizations/globalSelectionHeader/getParams';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import space from 'app/styles/space';
import {generateQueryWithTag} from 'app/utils';
import EventView from 'app/utils/discover/eventView';
import {ContentBox, HeaderBox, Main, Side} from 'app/utils/discover/styles';
import Tags from 'app/views/eventsV2/tags';
import SearchBar from 'app/views/events/searchBar';
import {decodeScalar} from 'app/utils/queryString';

import TransactionList from './transactionList';
import UserStats from './userStats';
import KeyTransactionButton from './keyTransactionButton';
import TransactionSummaryCharts from './charts';
import RelatedIssues from './relatedIssues';
import SidebarCharts from './sidebarCharts';
import Breadcrumb from '../breadcrumb';

type Props = {
  location: Location;
  eventView: EventView;
  transactionName: string;
  organization: Organization;
  totalValues: number | null;
};

class SummaryContent extends React.Component<Props> {
  handleSearch = (query: string) => {
    const {location} = this.props;

    const queryParams = getParams({
      ...(location.query || {}),
      query,
    });

    // do not propagate pagination when making a new search
    const searchQueryParams = omit(queryParams, 'cursor');

    browserHistory.push({
      pathname: location.pathname,
      query: searchQueryParams,
    });
  };

  generateTagUrl = (key: string, value: string) => {
    const {location} = this.props;
    const query = generateQueryWithTag(location.query, {key, value});

    return {
      ...location,
      query,
    };
  };

  renderKeyTransactionButton() {
    const {eventView, organization, transactionName} = this.props;

    return (
      <KeyTransactionButton
        transactionName={transactionName}
        eventView={eventView}
        organization={organization}
      />
    );
  }

  render() {
    const {transactionName, location, eventView, organization, totalValues} = this.props;
    const query = decodeScalar(location.query.query) || '';

    return (
      <React.Fragment>
        <HeaderBox>
          <div>
            <Breadcrumb
              organization={organization}
              location={location}
              transactionName={transactionName}
            />
          </div>
          <KeyTransactionContainer>
            {this.renderKeyTransactionButton()}
          </KeyTransactionContainer>
          <StyledTitleHeader>{transactionName}</StyledTitleHeader>
        </HeaderBox>
        <ContentBox>
          <StyledMain>
            <StyledSearchBar
              organization={organization}
              projectIds={eventView.project}
              query={query}
              fields={eventView.fields}
              onSearch={this.handleSearch}
            />
            <TransactionSummaryCharts
              organization={organization}
              location={location}
              eventView={eventView}
              totalValues={totalValues}
            />
            <TransactionList
              organization={organization}
              transactionName={transactionName}
              location={location}
              eventView={eventView}
            />
            <RelatedIssues
              organization={organization}
              location={location}
              transaction={transactionName}
              start={eventView.start}
              end={eventView.end}
              statsPeriod={eventView.statsPeriod}
            />
          </StyledMain>
          <Side>
            <UserStats
              organization={organization}
              location={location}
              eventView={eventView}
            />
            <SidebarCharts organization={organization} eventView={eventView} />
            <Tags
              generateUrl={this.generateTagUrl}
              totalValues={totalValues}
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

const StyledTitleHeader = styled('span')`
  font-size: ${p => p.theme.headerFontSize};
  color: ${p => p.theme.gray700};
  grid-column: 1/2;
  align-self: center;
  min-height: 30px;
  ${overflowEllipsis};
`;

// Allow overflow so chart tooltip and assignee dropdown display.
const StyledMain = styled(Main)`
  overflow: visible;
`;

const KeyTransactionContainer = styled('div')`
  display: flex;
  justify-content: flex-end;
`;

const StyledSearchBar = styled(SearchBar)`
  margin-bottom: ${space(1)};
`;

export default SummaryContent;
