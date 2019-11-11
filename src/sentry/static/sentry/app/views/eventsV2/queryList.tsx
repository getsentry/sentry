import React from 'react';
import {Location} from 'history';
import styled from 'react-emotion';

import space from 'app/styles/space';
import {Organization} from 'app/types';
import {trackAnalyticsEvent} from 'app/utils/analytics';
import theme from 'app/utils/theme';

import EventView from './eventView';
import {ALL_VIEWS, TRANSACTION_VIEWS} from './data';
import QueryCard from './querycard';
import MiniGraph from './miniGraph';

type Props = {
  organization: Organization;
  location: Location;
};

class QueryList extends React.Component<Props> {
  render() {
    const {location, organization} = this.props;
    let views = ALL_VIEWS;
    if (organization.features.includes('transaction-events')) {
      views = [...ALL_VIEWS, ...TRANSACTION_VIEWS];
    }

    const list = views.map((eventViewv1, index) => {
      const eventView = EventView.fromEventViewv1(eventViewv1);
      const to = {
        pathname: location.pathname,
        query: {
          ...location.query,
          ...eventView.generateQueryStringObject(),
        },
      };

      return (
        <QueryCard
          key={index}
          to={to}
          title={eventView.name}
          queryDetail={eventView.query}
          renderGraph={() => {
            return (
              <MiniGraph
                query={eventView.getEventsAPIPayload(location).query}
                eventView={eventView}
                organization={organization}
              />
            );
          }}
          onEventClick={() => {
            trackAnalyticsEvent({
              eventKey: 'discover_v2.prebuilt_query_click',
              eventName: 'Discoverv2: Click a pre-built query',
              organization_id: this.props.organization.id,
              query_name: eventView.name,
            });
          }}
        />
      );
    });

    return <QueryGrid>{list}</QueryGrid>;
  }
}

const QueryGrid = styled('div')`
  display: grid;
  grid-template-columns: minmax(100px, 1fr);
  grid-gap: ${space(3)};

  @media (min-width: ${theme.breakpoints[1]}) {
    grid-template-columns: repeat(2, minmax(100px, 1fr));
  }

  @media (min-width: ${theme.breakpoints[2]}) {
    grid-template-columns: repeat(3, minmax(100px, 1fr));
  }

  @media (min-width: ${theme.breakpoints[4]}) {
    grid-template-columns: repeat(5, minmax(100px, 1fr));
  }
`;

export default QueryList;
