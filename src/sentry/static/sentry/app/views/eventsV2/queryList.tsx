import React from 'react';
import {Location} from 'history';
import styled from 'react-emotion';

import {t} from 'app/locale';
import space from 'app/styles/space';
import {Organization} from 'app/types';
import {trackAnalyticsEvent} from 'app/utils/analytics';
import theme from 'app/utils/theme';
import withDiscoverSavedQueries from 'app/utils/withDiscoverSavedQueries';
import {SavedQuery} from 'app/stores/discoverSavedQueriesStore';

import EventView from './eventView';
import {ALL_VIEWS, TRANSACTION_VIEWS} from './data';
import QueryCard from './querycard';
import MiniGraph from './miniGraph';

type Props = {
  organization: Organization;
  location: Location;
  savedQueries: SavedQuery[];
  savedQueriesLoading: boolean;
};

class QueryList extends React.Component<Props> {
  renderPrebuiltQueries = () => {
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
          subtitle={t('Pre-Built Query')}
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

    return list;
  };

  renderSavedQueries = () => {
    const {savedQueries, location} = this.props;

    if (!savedQueries || !Array.isArray(savedQueries) || savedQueries.length === 0) {
      return [];
    }

    return savedQueries.map((savedQuery, index) => {
      const eventView = EventView.fromSavedQuery(savedQuery);
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
          subtitle={t('Saved Query')}
          queryDetail={eventView.query}
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
  };

  render() {
    return (
      <QueryGrid>
        {this.renderPrebuiltQueries()}
        {this.renderSavedQueries()}
      </QueryGrid>
    );
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

export default withDiscoverSavedQueries(QueryList);
