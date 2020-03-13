import React from 'react';
import {Location} from 'history';
import styled from '@emotion/styled';

import {Organization} from 'app/types';
import space from 'app/styles/space';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import EventView from 'app/views/eventsV2/eventView';
import {ContentBox, HeaderBox} from 'app/views/eventsV2/styles';
import Tags from 'app/views/eventsV2/tags';
import EventsV2 from 'app/utils/discover/eventsv2';

import SummaryContentTable from './table';
import Breadcrumb from './breadcrumb';
import UserStats from './user_stats';

const TOP_SLOWEST_TRANSACTIONS = 5;

type Props = {
  location: Location;
  eventView: EventView;
  transactionName: string;
  organization: Organization;
};

class SummaryContent extends React.Component<Props> {
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

const StyledTitleHeader = styled('h2')`
  font-size: ${p => p.theme.headerFontSize};
  font-weight: normal;
  line-height: 1.2;

  color: ${p => p.theme.gray4};
  grid-column: 1/2;
  align-self: center;
  ${overflowEllipsis};
`;

const Side = styled('div')`
  grid-column: 2/3;
`;

export default SummaryContent;
