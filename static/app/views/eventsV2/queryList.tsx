import * as React from 'react';
import {browserHistory, InjectedRouter} from 'react-router';
import styled from '@emotion/styled';
import {Location, Query} from 'history';
import moment from 'moment';

import {openAddDashboardWidgetModal} from 'sentry/actionCreators/modal';
import {resetPageFilters} from 'sentry/actionCreators/pageFilters';
import {Client} from 'sentry/api';
import Feature from 'sentry/components/acl/feature';
import Button from 'sentry/components/button';
import DropdownMenuControlV2 from 'sentry/components/dropdownMenuControlV2';
import {MenuItemProps} from 'sentry/components/dropdownMenuItemV2';
import EmptyStateWarning from 'sentry/components/emptyStateWarning';
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
  location: Location;
  onQueryChange: () => void;
  organization: Organization;
  pageLinks: string;
  renderPrebuilt: boolean;
  router: InjectedRouter;
  savedQueries: SavedQuery[];
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

  handleAddQueryToDashboard = (eventView: EventView, savedQuery?: SavedQuery) => {
    const {organization, router, location} = this.props;

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

    if (organization.features.includes('new-widget-builder-experience')) {
      router.push({
        pathname: `/organizations/${organization.slug}/dashboards/new/widget/new/`,
        query: {
          ...location.query,
          source: DashboardWidgetSource.DISCOVERV2,
        },
      });
      return;
    }

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

  renderDropdownMenu(items: MenuItemProps[]) {
    return (
      <DropdownMenuControlV2
        items={items}
        trigger={({props: triggerProps, ref: triggerRef}) => (
          <DropdownTrigger
            ref={triggerRef}
            {...triggerProps}
            aria-label={t('Query actions')}
            size="xsmall"
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
        placement="bottom right"
        offset={4}
      />
    );
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

      const menuItems = [
        {
          key: 'add-to-dashboard',
          label: t('Add to Dashboard'),
          onAction: () => this.handleAddQueryToDashboard(eventView),
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
            trackAnalyticsEvent({
              eventKey: 'discover_v2.prebuilt_query_click',
              eventName: 'Discoverv2: Click a pre-built query',
              organization_id: parseInt(this.props.organization.id, 10),
              query_name: eventView.name,
            });
          }}
          renderContextMenu={() => (
            <Feature organization={organization} features={['dashboards-edit']}>
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

      const menuItems = (canAddToDashboard: boolean): MenuItemProps[] => [
        ...(canAddToDashboard
          ? [
              {
                key: 'add-to-dashboard',
                label: t('Add to Dashboard'),
                onAction: () => this.handleAddQueryToDashboard(eventView, savedQuery),
              },
            ]
          : []),
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
            trackAnalyticsEvent({
              eventKey: 'discover_v2.saved_query_click',
              eventName: 'Discoverv2: Click a saved query',
              organization_id: parseInt(this.props.organization.id, 10),
            });
          }}
          renderGraph={() => (
            <MiniGraph
              location={location}
              eventView={eventView}
              organization={organization}
              referrer={referrer}
              yAxis={
                savedQuery.yAxis && savedQuery.yAxis.length
                  ? savedQuery.yAxis
                  : ['count()']
              }
            />
          )}
          renderContextMenu={() => (
            <Feature
              organization={organization}
              features={['connect-discover-and-dashboards', 'dashboards-edit']}
            >
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

const DropdownTrigger = styled(Button)`
  transform: translateX(${space(1)});
`;

const StyledEmptyStateWarning = styled(EmptyStateWarning)`
  grid-column: 1 / 4;
`;

export default withApi(QueryList);
