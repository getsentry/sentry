import * as React from 'react';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';
import classNames from 'classnames';
import {Location, Query} from 'history';
import moment from 'moment';

import {openAddDashboardWidgetModal} from 'sentry/actionCreators/modal';
import {resetPageFilters} from 'sentry/actionCreators/pageFilters';
import {Client} from 'sentry/api';
import Feature from 'sentry/components/acl/feature';
import DropdownMenu from 'sentry/components/dropdownMenu';
import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import MenuItem from 'sentry/components/menuItem';
import Pagination from 'sentry/components/pagination';
import TimeSince from 'sentry/components/timeSince';
import {IconEllipsis} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization, SavedQuery} from 'sentry/types';
import {trackAnalyticsEvent} from 'sentry/utils/analytics';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import EventView from 'sentry/utils/discover/eventView';
import {DisplayModes} from 'sentry/utils/discover/types';
import parseLinkHeader from 'sentry/utils/parseLinkHeader';
import {decodeList} from 'sentry/utils/queryString';
import withApi from 'sentry/utils/withApi';
import {
  DashboardWidgetSource,
  DisplayType,
  WidgetQuery,
} from 'sentry/views/dashboardsV2/types';

import {
  displayModeToDisplayType,
  handleCreateQuery,
  handleDeleteQuery,
} from './savedQuery/utils';
import MiniGraph from './miniGraph';
import QueryCard from './querycard';
import {getPrebuiltQueries} from './utils';

type Props = {
  api: Client;
  organization: Organization;
  location: Location;
  savedQueries: SavedQuery[];
  renderPrebuilt: boolean;
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
    resetPageFilters();
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

  handleDuplicateQuery =
    (eventView: EventView, yAxis: string[]) => (event: React.MouseEvent<Element>) => {
      event.preventDefault();
      event.stopPropagation();

      const {api, location, organization, onQueryChange} = this.props;

      eventView = eventView.clone();
      eventView.name = `${eventView.name} copy`;

      handleCreateQuery(api, organization, eventView, yAxis).then(() => {
        onQueryChange();
        browserHistory.push({
          pathname: location.pathname,
          query: {},
        });
      });
    };

  handleAddQueryToDashboard =
    (eventView: EventView, savedQuery?: SavedQuery) =>
    (event: React.MouseEvent<Element>) => {
      const {organization} = this.props;
      event.preventDefault();
      event.stopPropagation();

      const displayType = displayModeToDisplayType(eventView.display as DisplayModes);
      const defaultTableColumns = eventView.fields.map(({field}) => field);
      const sort = eventView.sorts[0];
      const defaultWidgetQuery: WidgetQuery = {
        name: '',
        fields: [
          ...(displayType === DisplayType.TOP_N ? defaultTableColumns : []),
          ...(typeof savedQuery?.yAxis === 'string'
            ? [savedQuery?.yAxis]
            : savedQuery?.yAxis ?? ['count()']),
        ],
        conditions: eventView.query,
        orderby: sort ? `${sort.kind === 'desc' ? '-' : ''}${sort.field}` : '',
      };

      trackAdvancedAnalyticsEvent('discover_views.add_to_dashboard.modal_open', {
        organization,
        saved_query: !!savedQuery,
      });

      openAddDashboardWidgetModal({
        organization,
        start: eventView.start,
        end: eventView.end,
        statsPeriod: eventView.statsPeriod,
        source: DashboardWidgetSource.DISCOVERV2,
        defaultWidgetQuery,
        defaultTableColumns,
        defaultTitle:
          savedQuery?.name ??
          (eventView.name !== 'All Events' ? eventView.name : undefined),
        displayType,
      });
    };

  renderQueries() {
    const {pageLinks, renderPrebuilt} = this.props;
    const links = parseLinkHeader(pageLinks || '');
    let cards: React.ReactNode[] = [];

    // If we're on the first page (no-previous page exists)
    // include the pre-built queries.
    if (renderPrebuilt && (!links.previous || links.previous.results === false)) {
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
              referrer="api.discover.homepage.prebuilt"
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
          renderContextMenu={() => (
            <Feature
              organization={organization}
              features={['connect-discover-and-dashboards', 'dashboards-edit']}
            >
              {({hasFeature}) => {
                return (
                  hasFeature && (
                    <ContextMenu>
                      <StyledMenuItem
                        data-test-id="add-query-to-dashboard"
                        onClick={this.handleAddQueryToDashboard(eventView)}
                      >
                        {t('Add to Dashboard')}
                      </StyledMenuItem>
                    </ContextMenu>
                  )
                );
              }}
            </Feature>
          )}
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

      const to = eventView.getResultsViewShortUrlTarget(organization.slug);
      const dateStatus = <TimeSince date={savedQuery.dateUpdated} />;
      const referrer = `api.discover.${eventView.getDisplayMode()}-chart`;

      return (
        <QueryCard
          key={`${index}-${eventView.id}`}
          to={to}
          title={eventView.name}
          subtitle={eventView.statsPeriod ? recentTimeline : customTimeline}
          queryDetail={eventView.query}
          createdBy={eventView.createdBy}
          dateStatus={dateStatus}
          onEventClick={() => {
            trackAnalyticsEvent({
              eventKey: 'discover_v2.saved_query_click',
              eventName: 'Discoverv2: Click a saved query',
              organization_id: parseInt(this.props.organization.id, 10),
            });
          }}
          renderGraph={() => (
            <Feature
              organization={organization}
              features={['connect-discover-and-dashboards']}
            >
              {({hasFeature}) => (
                <MiniGraph
                  location={location}
                  eventView={eventView}
                  organization={organization}
                  referrer={referrer}
                  yAxis={
                    hasFeature && savedQuery.yAxis && savedQuery.yAxis.length
                      ? savedQuery.yAxis
                      : ['count()']
                  }
                />
              )}
            </Feature>
          )}
          renderContextMenu={() => (
            <ContextMenu>
              <Feature
                organization={organization}
                features={['connect-discover-and-dashboards', 'dashboards-edit']}
              >
                {({hasFeature}) =>
                  hasFeature && (
                    <StyledMenuItem
                      data-test-id="add-query-to-dashboard"
                      onClick={this.handleAddQueryToDashboard(eventView, savedQuery)}
                    >
                      {t('Add to Dashboard')}
                    </StyledMenuItem>
                  )
                }
              </Feature>
              <MenuItem
                data-test-id="delete-query"
                onClick={this.handleDeleteQuery(eventView)}
              >
                {t('Delete Query')}
              </MenuItem>
              <MenuItem
                data-test-id="duplicate-query"
                onClick={this.handleDuplicateQuery(
                  eventView,
                  decodeList(savedQuery.yAxis)
                )}
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
        <PaginationRow
          pageLinks={pageLinks}
          onCursor={(cursor, path, query, direction) => {
            const offset = Number(cursor?.split(':')?.[1] ?? 0);

            const newQuery: Query & {cursor?: string} = {...query, cursor};
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

const PaginationRow = styled(Pagination)`
  margin-bottom: 20px;
`;

const QueryGrid = styled('div')`
  display: grid;
  grid-template-columns: minmax(100px, 1fr);
  gap: ${space(2)};

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
            {...getActorProps<HTMLDivElement>({
              onClick: (event: React.MouseEvent) => {
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
  color: ${p => p.theme.textColor};
`;

const DropdownTarget = styled('div')`
  display: flex;
`;
const StyledEmptyStateWarning = styled(EmptyStateWarning)`
  grid-column: 1 / 4;
`;

const StyledMenuItem = styled(MenuItem)`
  white-space: nowrap;
  span {
    align-items: baseline;
  }
`;

export default withApi(QueryList);
