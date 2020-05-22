import {browserHistory} from 'react-router';
import React, {MouseEvent} from 'react';
import classNames from 'classnames';
import moment from 'moment';
import styled from '@emotion/styled';
import {Location, Query} from 'history';

import {Client} from 'app/api';
import {IconEllipsis} from 'app/icons';
import {Organization, SavedQuery} from 'app/types';
import {resetGlobalSelection} from 'app/actionCreators/globalSelection';
import {t} from 'app/locale';
import {trackAnalyticsEvent} from 'app/utils/analytics';
import DropdownMenu from 'app/components/dropdownMenu';
import EmptyStateWarning from 'app/components/emptyStateWarning';
import EventView from 'app/utils/discover/eventView';
import MenuItem from 'app/components/menuItem';
import Pagination from 'app/components/pagination';
import parseLinkHeader from 'app/utils/parseLinkHeader';
import space from 'app/styles/space';
import withApi from 'app/utils/withApi';

import {getPrebuiltQueries} from './utils';
import {handleDeleteQuery, handleCreateQuery} from './savedQuery/utils';
import MiniGraph from './miniGraph';
import QueryCard from './querycard';

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
  componentDidMount() {
    /**
     * We need to reset global selection here because the saved queries can define their own projects
     * in the query. This can lead to mismatched queries for the project
     */
    resetGlobalSelection();
  }

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

    if (cards.filter(x => x).length === 0) {
      return (
        <StyledEmptyStateWarning>
          <p>{t('No saved queries match that filter')}</p>
        </StyledEmptyStateWarning>
      );
    }

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

      const to = eventView.getResultsViewUrlTarget(organization.slug);

      return (
        <QueryCard
          key={`${index}-${eventView.name}`}
          to={to}
          title={eventView.name}
          subtitle={eventView.statsPeriod ? recentTimeline : customTimeline}
          queryDetail={eventView.query}
          createdBy={eventView.createdBy}
          renderGraph={() => (
            <MiniGraph
              location={location}
              eventView={eventView}
              organization={organization}
            />
          )}
          onEventClick={() => {
            trackAnalyticsEvent({
              eventKey: 'discover_v2.prebuilt_query_click',
              eventName: 'Discoverv2: Click a pre-built query',
              organization_id: parseInt(this.props.organization.id, 10),
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

      const to = eventView.getResultsViewUrlTarget(organization.slug);

      return (
        <QueryCard
          key={`${index}-${eventView.id}`}
          to={to}
          title={eventView.name}
          subtitle={eventView.statsPeriod ? recentTimeline : customTimeline}
          queryDetail={eventView.query}
          createdBy={eventView.createdBy}
          onEventClick={() => {
            trackAnalyticsEvent({
              eventKey: 'discover_v2.prebuilt_query_click',
              eventName: 'Discoverv2: Click a pre-built query',
              organization_id: parseInt(this.props.organization.id, 10),
              query_name: eventView.name,
            });
          }}
          renderGraph={() => (
            <MiniGraph
              location={location}
              eventView={eventView}
              organization={organization}
            />
          )}
          renderContextMenu={() => (
            <ContextMenu>
              <MenuItem
                data-test-id="delete-query"
                onClick={this.handleDeleteQuery(eventView)}
              >
                {t('Delete Query')}
              </MenuItem>
              <MenuItem
                data-test-id="duplicate-query"
                onClick={this.handleDuplicateQuery(eventView)}
              >
                {t('Duplicate Query')}
              </MenuItem>
            </ContextMenu>
          )}
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

const ContextMenu = ({children}) => (
  <DropdownMenu>
    {({isOpen, getRootProps, getActorProps, getMenuProps}) => {
      const topLevelCx = classNames('dropdown', {
        'anchor-right': true,
        open: isOpen,
      });

      return (
        <MoreOptions
          {...getRootProps({
            className: topLevelCx,
          })}
        >
          <DropdownTarget
            {...getActorProps({
              onClick: (event: MouseEvent) => {
                event.stopPropagation();
                event.preventDefault();
              },
            })}
          >
            <IconEllipsis data-test-id="context-menu" size="md" />
          </DropdownTarget>
          {isOpen && (
            <ul {...getMenuProps({})} className={classNames('dropdown-menu')}>
              {children}
            </ul>
          )}
        </MoreOptions>
      );
    }}
  </DropdownMenu>
);

const MoreOptions = styled('span')`
  display: flex;
`;

const DropdownTarget = styled('div')`
  display: flex;
`;
const StyledEmptyStateWarning = styled(EmptyStateWarning)`
  grid-column: 1 / 4;
`;

export default withApi(QueryList);
