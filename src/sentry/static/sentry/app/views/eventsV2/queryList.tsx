import React, {MouseEvent} from 'react';
import {Location, Query} from 'history';
import styled from 'react-emotion';
import classNames from 'classnames';
import moment from 'moment';
import {browserHistory} from 'react-router';

import {t} from 'app/locale';
import space from 'app/styles/space';
import {Organization, SavedQuery} from 'app/types';
import {trackAnalyticsEvent} from 'app/utils/analytics';
import {Client} from 'app/api';
import InlineSvg from 'app/components/inlineSvg';
import DropdownMenu from 'app/components/dropdownMenu';
import MenuItem from 'app/components/menuItem';
import Pagination from 'app/components/pagination';
import withApi from 'app/utils/withApi';
import parseLinkHeader from 'app/utils/parseLinkHeader';

import EventView from './eventView';
import QueryCard from './querycard';
import MiniGraph from './miniGraph';
import {getPrebuiltQueries} from './utils';
import {handleDeleteQuery, handleCreateQuery} from './savedQuery/utils';
import {generateDiscoverResultsRoute} from './results';

type Props = {
  api: Client;
  organization: Organization;
  location: Location;
  savedQueries: SavedQuery[];
  pageLinks: string;
  onQueryChange: () => void;
  savedQuerySearchQuery: string;
};

class QueryList extends React.Component<Props> {
  handleDeleteQuery = (eventView: EventView) => (event: React.MouseEvent<Element>) => {
    event.preventDefault();
    event.stopPropagation();

    const {api, organization, onQueryChange, location, savedQueries} = this.props;

    handleDeleteQuery(api, organization, eventView).then(() => {
      if (savedQueries.length === 1 && location.query.cursor) {
        browserHistory.push({
          pathname: location.pathname,
          query: {...location.query, cursor: undefined},
        });
      } else {
        onQueryChange();
      }
    });
  };

  handleDuplicateQuery = (eventView: EventView) => (event: React.MouseEvent<Element>) => {
    event.preventDefault();
    event.stopPropagation();

    const {api, location, organization, onQueryChange} = this.props;

    eventView = eventView.clone();
    eventView.name = `${eventView.name} copy`;

    handleCreateQuery(api, organization, eventView).then(() => {
      onQueryChange();
      browserHistory.push({
        pathname: location.pathname,
        query: {},
      });
    });
  };

  renderQueries() {
    const {pageLinks} = this.props;
    const links = parseLinkHeader(pageLinks || '');
    let cards: React.ReactNode[] = [];

    // If we're on the first page (no-previous page exists)
    // include the pre-built queries.
    if (!links.previous || links.previous.results === false) {
      cards = cards.concat(this.renderPrebuiltQueries());
    }
    cards = cards.concat(this.renderSavedQueries());

    return cards;
  }

  renderPrebuiltQueries() {
    const {location, organization, savedQuerySearchQuery} = this.props;
    const views = getPrebuiltQueries(organization);

    const hasSearchQuery =
      typeof savedQuerySearchQuery === 'string' && savedQuerySearchQuery.length > 0;
    const needleSearch = hasSearchQuery ? savedQuerySearchQuery.toLowerCase() : '';

    const list = views.map((view, index) => {
      const eventView = EventView.fromNewQueryWithLocation(view, location);

      // if a search is performed on the list of queries, we filter
      // on the pre-built queries
      if (
        hasSearchQuery &&
        eventView.name &&
        !eventView.name.toLowerCase().includes(needleSearch)
      ) {
        return null;
      }

      const recentTimeline = t('Last ') + eventView.statsPeriod;
      const customTimeline =
        moment(eventView.start).format('MMM D, YYYY h:mm A') +
        ' - ' +
        moment(eventView.end).format('MMM D, YYYY h:mm A');

      const to = {
        pathname: generateDiscoverResultsRoute(organization.slug),
        query: {
          ...location.query,
          // remove any landing page cursor
          cursor: undefined,
          ...eventView.generateQueryStringObject(),
        },
      };

      return (
        <QueryCard
          key={`${index}-${eventView.name}`}
          to={to}
          title={eventView.name}
          subtitle={eventView.statsPeriod ? recentTimeline : customTimeline}
          queryDetail={eventView.query}
          renderGraph={() => {
            return (
              <MiniGraph
                location={location}
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
  }

  renderSavedQueries() {
    const {savedQueries, location, organization} = this.props;

    if (!savedQueries || !Array.isArray(savedQueries) || savedQueries.length === 0) {
      return [];
    }

    return savedQueries.map((savedQuery, index) => {
      const eventView = EventView.fromSavedQuery(savedQuery);
      const recentTimeline = t('Last ') + eventView.statsPeriod;
      const customTimeline =
        moment(eventView.start).format('MMM D, YYYY h:mm A') +
        ' - ' +
        moment(eventView.end).format('MMM D, YYYY h:mm A');
      const to = {
        pathname: generateDiscoverResultsRoute(organization.slug),
        query: {
          ...location.query,
          // remove any landing page cursor
          cursor: undefined,
          ...eventView.generateQueryStringObject(),
        },
      };

      return (
        <QueryCard
          key={`${index}-${eventView.id}`}
          to={to}
          starred
          title={eventView.name}
          subtitle={eventView.statsPeriod ? recentTimeline : customTimeline}
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
                location={location}
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
  }

  render() {
    const {pageLinks} = this.props;
    return (
      <React.Fragment>
        <QueryGrid>{this.renderQueries()}</QueryGrid>
        <Pagination
          pageLinks={pageLinks}
          onCursor={(cursor: string, path: string, query: Query, direction: number) => {
            const offset = Number(cursor.split(':')[1]);

            const newQuery = {...query, cursor};
            const isPrevious = direction === -1;

            if (offset <= 0 && isPrevious) {
              delete newQuery.cursor;
            }

            browserHistory.push({
              pathname: path,
              query: newQuery,
            });
          }}
        />
      </React.Fragment>
    );
  }
}

const QueryGrid = styled('div')`
  display: grid;
  grid-template-columns: minmax(100px, 1fr);
  grid-gap: ${space(3)};

  @media (min-width: ${p => p.theme.breakpoints[1]}) {
    grid-template-columns: repeat(2, minmax(100px, 1fr));
  }

  @media (min-width: ${p => p.theme.breakpoints[2]}) {
    grid-template-columns: repeat(3, minmax(100px, 1fr));
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
                data-test-id="context-menu"
                {...getActorProps({
                  onClick: (event: MouseEvent) => {
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

export default withApi(QueryList);
