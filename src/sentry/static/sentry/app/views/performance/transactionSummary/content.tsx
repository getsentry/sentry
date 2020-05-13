import React from 'react';
import {Location} from 'history';
import styled from '@emotion/styled';

import {Organization} from 'app/types';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import EventView from 'app/utils/discover/eventView';
import Tags from 'app/views/eventsV2/tags';
import {ContentBox, HeaderBox, Main, Side} from 'app/utils/discover/styles';
import DiscoverQuery from 'app/utils/discover/discoverQuery';

import SummaryContentTable from './table';
import Breadcrumb from './breadcrumb';
import UserStats from './userStats';
import KeyTransactionButton from './keyTransactionButton';
import TransactionSummaryCharts from './charts';
import RelatedIssues from './relatedIssues';
import SidebarCharts from './sidebarCharts';

const TOP_SLOWEST_TRANSACTIONS = 5;

type Props = {
  location: Location;
  eventView: EventView;
  transactionName: string;
  organization: Organization;
  totalValues: number | null;
};

class SummaryContent extends React.Component<Props> {
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
          <KeyTransactionContainer>
            {this.renderKeyTransactionButton()}
          </KeyTransactionContainer>
          <StyledTitleHeader>{transactionName}</StyledTitleHeader>
        </HeaderBox>
        <ContentBox>
          <StyledMain>
            <TransactionSummaryCharts
              organization={organization}
              location={location}
              eventView={eventView}
              totalValues={totalValues}
            />
            <DiscoverQuery
              location={location}
              eventView={eventView}
              orgSlug={organization.slug}
              extraQuery={{
                per_page: TOP_SLOWEST_TRANSACTIONS,
              }}
            >
              {({isLoading, tableData}) => (
                <SummaryContentTable
                  organization={organization}
                  location={location}
                  eventView={eventView}
                  tableData={tableData}
                  isLoading={isLoading}
                />
              )}
            </DiscoverQuery>
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
  color: ${p => p.theme.gray4};
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

export default SummaryContent;
