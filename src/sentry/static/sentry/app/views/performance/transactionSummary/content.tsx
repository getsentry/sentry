import React from 'react';
import {Location} from 'history';
import styled from '@emotion/styled';

import {Organization} from 'app/types';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import EventView from 'app/utils/discover/eventView';
import {ContentBox, HeaderBox} from 'app/views/eventsV2/styles';
import Tags from 'app/views/eventsV2/tags';
import EventsV2 from 'app/utils/discover/eventsv2';

import SummaryContentTable from './table';
import Breadcrumb from './breadcrumb';
import UserStats from './userStats';
import KeyTransactionButton from './keyTransactionButton';

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
          <EventsV2
            location={location}
            eventView={eventView}
            organization={organization}
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
                totalValues={totalValues}
              />
            )}
          </EventsV2>
          <Side>
            <UserStats
              organization={organization}
              location={location}
              eventView={eventView}
            />
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

const Side = styled('div')`
  grid-column: 2/3;
`;

const KeyTransactionContainer = styled('div')`
  display: flex;
  justify-content: flex-end;
`;

export default SummaryContent;
