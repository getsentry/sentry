import React from 'react';
import {Location} from 'history';
import styled from 'react-emotion';
import classNames from 'classnames';
import {browserHistory} from 'react-router';

import {t} from 'app/locale';
import space from 'app/styles/space';
import {Organization} from 'app/types';
import {trackAnalyticsEvent} from 'app/utils/analytics';
import theme from 'app/utils/theme';
import withDiscoverSavedQueries from 'app/utils/withDiscoverSavedQueries';
import {SavedQuery} from 'app/stores/discoverSavedQueriesStore';
import withApi from 'app/utils/withApi';
import {Client} from 'app/api';
import {fetchSavedQueries} from 'app/actionCreators/discoverSavedQueries';
import InlineSvg from 'app/components/inlineSvg';
import DropdownMenu from 'app/components/dropdownMenu';
import MenuItem from 'app/components/menuItem';

import EventView from './eventView';
import {ALL_VIEWS, TRANSACTION_VIEWS} from './data';
import QueryCard from './querycard';
import MiniGraph from './miniGraph';
import {handleDeleteQuery, handleCreateQuery} from './savedQuery/utils';

type Props = {
  api: Client;
  organization: Organization;
  location: Location;
  savedQueries: SavedQuery[];
  savedQueriesLoading: boolean;
};

class QueryList extends React.Component<Props> {
  componentDidMount() {
    const {api, organization} = this.props;
    fetchSavedQueries(api, organization.slug);
  }

  handleDeleteQuery = (eventView: EventView) => (event: React.MouseEvent<Element>) => {
    event.preventDefault();

    const {api, location, organization} = this.props;

    handleDeleteQuery(api, organization, eventView).then(() => {
      browserHistory.push({
        pathname: location.pathname,
        query: {},
      });
    });
  };

  handleDuplicateQuery = (eventView: EventView) => (event: React.MouseEvent<Element>) => {
    event.preventDefault();

    const {api, location, organization} = this.props;

    eventView = eventView.clone();
    eventView.name = `${eventView.name} copy`;

    handleCreateQuery(api, organization, eventView).then(() => {
      browserHistory.push({
        pathname: location.pathname,
        query: {},
      });
    });
  };

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
          key={`${index}-${eventView.name}`}
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
    const {savedQueries, location, organization} = this.props;

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
          key={`${index}-${eventView.id}`}
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
          renderGraph={() => {
            return (
              <MiniGraph
                query={eventView.getEventsAPIPayload(location).query}
                eventView={eventView}
                organization={organization}
              />
            );
          }}
          renderContextMenu={() => {
            return (
              <ContextMenu>
                <MenuItem
                  href="#delete-query"
                  onClick={this.handleDeleteQuery(eventView)}
                >
                  {t('Delete Query')}
                </MenuItem>
                <MenuItem
                  href="#duplicate-query"
                  onClick={this.handleDuplicateQuery(eventView)}
                >
                  {t('Duplicate Query')}
                </MenuItem>
              </ContextMenu>
            );
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

class ContextMenu extends React.Component {
  render() {
    const {children} = this.props;

    return (
      <DropdownMenu>
        {({isOpen, getRootProps, getActorProps, getMenuProps}) => {
          const topLevelCx = classNames('dropdown', {
            'pull-right': true,
            'anchor-right': true,
            open: isOpen,
          });

          return (
            <span
              {...getRootProps({
                className: topLevelCx,
              })}
            >
              <ContextMenuButton
                {...getActorProps({
                  onClick: event => {
                    event.stopPropagation();
                    event.preventDefault();
                  },
                }) as any}
              >
                <InlineSvg src="icon-ellipsis-filled" />
              </ContextMenuButton>

              {isOpen && (
                <ul {...getMenuProps({}) as any} className={classNames('dropdown-menu')}>
                  {children}
                </ul>
              )}
            </span>
          );
        }}
      </DropdownMenu>
    );
  }
}

const ContextMenuButton = styled('div')`
  border-radius: 3px;
  background-color: ${p => p.theme.offWhite};
  padding-left: 8px;
  padding-right: 8px;

  &:hover {
    background-color: ${p => p.theme.offWhite2};
  }
`;

export default withApi(withDiscoverSavedQueries(QueryList));
