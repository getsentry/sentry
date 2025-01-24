import {Component, Fragment} from 'react';
import styled from '@emotion/styled';
import type {Location, Query} from 'history';
import moment from 'moment-timezone';

import {resetPageFilters} from 'sentry/actionCreators/pageFilters';
import type {Client} from 'sentry/api';
import Feature from 'sentry/components/acl/feature';
import {Button} from 'sentry/components/button';
import type {MenuItemProps} from 'sentry/components/dropdownMenu';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import Pagination from 'sentry/components/pagination';
import TimeSince from 'sentry/components/timeSince';
import {IconEllipsis} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {InjectedRouter} from 'sentry/types/legacyReactRouter';
import type {NewQuery, Organization, SavedQuery} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';
import {browserHistory} from 'sentry/utils/browserHistory';
import EventView from 'sentry/utils/discover/eventView';
import parseLinkHeader from 'sentry/utils/parseLinkHeader';
import {decodeList} from 'sentry/utils/queryString';
import withApi from 'sentry/utils/withApi';
import {DashboardWidgetSource} from 'sentry/views/dashboards/types';
import {hasDatasetSelector} from 'sentry/views/dashboards/utils';

import {
  getSavedQueryDataset,
  getSavedQueryWithDataset,
  handleCreateQuery,
  handleDeleteQuery,
  handleUpdateHomepageQuery,
} from './savedQuery/utils';
import MiniGraph from './miniGraph';
import QueryCard from './querycard';
import {
  getPrebuiltQueries,
  handleAddQueryToDashboard,
  SAVED_QUERY_DATASET_TO_WIDGET_TYPE,
} from './utils';

type Props = {
  api: Client;
  location: Location;
  onQueryChange: () => void;
  organization: Organization;
  pageLinks: string;
  renderPrebuilt: boolean;
  router: InjectedRouter;
  savedQueries: SavedQuery[];
  savedQuerySearchQuery: string;
};

class QueryList extends Component<Props> {
  componentDidMount() {
    /**
     * We need to reset global selection here because the saved queries can define their own projects
     * in the query. This can lead to mismatched queries for the project
     */
    resetPageFilters();
  }

  handleDeleteQuery = (eventView: EventView) => {
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

  handleDuplicateQuery = (eventView: EventView, yAxis: string[]) => {
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

  renderDropdownMenu(items: MenuItemProps[]) {
    return (
      <DropdownMenu
        items={items}
        trigger={triggerProps => (
          <DropdownTrigger
            {...triggerProps}
            aria-label={t('Query actions')}
            size="xs"
            borderless
            onClick={e => {
              e.stopPropagation();
              e.preventDefault();

              triggerProps.onClick?.(e);
            }}
            icon={<IconEllipsis direction="down" size="sm" />}
            data-test-id="menu-trigger"
          />
        )}
        position="bottom-end"
        offset={4}
      />
    );
  }

  renderPrebuiltQueries() {
    const {api, location, organization, savedQuerySearchQuery, router} = this.props;
    const views = getPrebuiltQueries(organization);

    const hasSearchQuery =
      typeof savedQuerySearchQuery === 'string' && savedQuerySearchQuery.length > 0;
    const needleSearch = hasSearchQuery ? savedQuerySearchQuery.toLowerCase() : '';

    const list = views.map((view, index) => {
      const newQuery = organization.features.includes(
        'performance-discover-dataset-selector'
      )
        ? (getSavedQueryWithDataset(view) as NewQuery)
        : view;
      const eventView = EventView.fromNewQueryWithLocation(newQuery, location);

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

      const to = eventView.getResultsViewUrlTarget(
        organization.slug,
        false,
        hasDatasetSelector(organization) ? view.queryDataset : undefined
      );

      const menuItems = [
        {
          key: 'add-to-dashboard',
          label: t('Add to Dashboard'),
          onAction: () =>
            handleAddQueryToDashboard({
              eventView,
              location,
              query: view,
              organization,
              yAxis: view?.yAxis,
              router,
              widgetType: hasDatasetSelector(organization)
                ? // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
                  SAVED_QUERY_DATASET_TO_WIDGET_TYPE[
                    getSavedQueryDataset(organization, location, newQuery)
                  ]
                : undefined,
              source: DashboardWidgetSource.DISCOVERV2,
            }),
        },
        {
          key: 'set-as-default',
          label: t('Set as Default'),
          onAction: () => {
            handleUpdateHomepageQuery(api, organization, eventView.toNewQuery());
            trackAnalytics('discover_v2.set_as_default', {
              organization,
              source: 'context-menu',
              type: 'prebuilt-query',
            });
          },
        },
      ];

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
            trackAnalytics('discover_v2.prebuilt_query_click', {
              organization,
              query_name: eventView.name,
            });
          }}
          renderContextMenu={() => (
            <Feature organization={organization} features="dashboards-edit">
              {({hasFeature}) => {
                return hasFeature && this.renderDropdownMenu(menuItems);
              }}
            </Feature>
          )}
        />
      );
    });

    return list;
  }

  renderSavedQueries() {
    const {api, savedQueries, location, organization, router} = this.props;

    if (!savedQueries || !Array.isArray(savedQueries) || savedQueries.length === 0) {
      return [];
    }

    return savedQueries.map((query, index) => {
      const savedQuery = organization.features.includes(
        'performance-discover-dataset-selector'
      )
        ? (getSavedQueryWithDataset(query) as SavedQuery)
        : query;
      const eventView = EventView.fromSavedQuery(savedQuery);
      const recentTimeline = t('Last ') + eventView.statsPeriod;
      const customTimeline =
        moment(eventView.start).format('MMM D, YYYY h:mm A') +
        ' - ' +
        moment(eventView.end).format('MMM D, YYYY h:mm A');

      const to = eventView.getResultsViewShortUrlTarget(organization.slug);
      const dateStatus = <TimeSince date={savedQuery.dateUpdated} />;
      const referrer = `api.discover.${eventView.getDisplayMode()}-chart`;

      const menuItems = (canAddToDashboard: boolean): MenuItemProps[] => [
        ...(canAddToDashboard
          ? [
              {
                key: 'add-to-dashboard',
                label: t('Add to Dashboard'),
                onAction: () =>
                  handleAddQueryToDashboard({
                    eventView,
                    location,
                    query: savedQuery,
                    organization,
                    yAxis: savedQuery?.yAxis ?? eventView.yAxis,
                    router,
                    widgetType: hasDatasetSelector(organization)
                      ? // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
                        SAVED_QUERY_DATASET_TO_WIDGET_TYPE[
                          getSavedQueryDataset(organization, location, savedQuery)
                        ]
                      : undefined,
                    source: DashboardWidgetSource.DISCOVERV2,
                  }),
              },
            ]
          : []),
        {
          key: 'set-as-default',
          label: t('Set as Default'),
          onAction: () => {
            handleUpdateHomepageQuery(api, organization, eventView.toNewQuery());
            trackAnalytics('discover_v2.set_as_default', {
              organization,
              source: 'context-menu',
              type: 'saved-query',
            });
          },
        },
        {
          key: 'duplicate',
          label: t('Duplicate Query'),
          onAction: () =>
            this.handleDuplicateQuery(eventView, decodeList(savedQuery.yAxis)),
        },
        {
          key: 'delete',
          label: t('Delete Query'),
          priority: 'danger',
          onAction: () => this.handleDeleteQuery(eventView),
        },
      ];

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
            trackAnalytics('discover_v2.saved_query_click', {organization});
          }}
          renderGraph={() => (
            <MiniGraph
              location={location}
              eventView={eventView}
              organization={organization}
              referrer={referrer}
              yAxis={savedQuery.yAxis?.length ? savedQuery.yAxis : ['count()']}
            />
          )}
          renderContextMenu={() => (
            <Feature organization={organization} features="dashboards-edit">
              {({hasFeature}) => this.renderDropdownMenu(menuItems(hasFeature))}
            </Feature>
          )}
        />
      );
    });
  }

  render() {
    const {pageLinks} = this.props;
    return (
      <Fragment>
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
      </Fragment>
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

  @media (min-width: ${p => p.theme.breakpoints.medium}) {
    grid-template-columns: repeat(2, minmax(100px, 1fr));
  }

  @media (min-width: ${p => p.theme.breakpoints.large}) {
    grid-template-columns: repeat(3, minmax(100px, 1fr));
  }
`;

const DropdownTrigger = styled(Button)`
  transform: translateX(${space(1)});
`;

const StyledEmptyStateWarning = styled(EmptyStateWarning)`
  grid-column: 1 / 4;
`;

export default withApi(QueryList);
