import {Fragment, useEffect} from 'react';
import styled from '@emotion/styled';
import {IconEllipsis} from '@sentry/icons/ellipsis';
import type {Location, Query} from 'history';
import moment from 'moment-timezone';

import {Button} from '@sentry/scraps/button';
import type {MenuItemProps} from '@sentry/scraps/dropdownMenu';
import {DropdownMenu} from '@sentry/scraps/dropdownMenu';
import {Grid} from '@sentry/scraps/layout';
import {Pagination} from '@sentry/scraps/pagination';

import Feature from 'sentry/components/acl/feature';
import {EmptyStateWarning} from 'sentry/components/emptyStateWarning';
import {resetPageFilters} from 'sentry/components/pageFilters/actions';
import {TimeSince} from 'sentry/components/timeSince';
import {t, tct} from 'sentry/locale';
import type {NewQuery, Organization, SavedQuery} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';
import {EventView} from 'sentry/utils/discover/eventView';
import {SavedQueryDatasets} from 'sentry/utils/discover/types';
import {parseLinkHeader} from 'sentry/utils/parseLinkHeader';
import {decodeList} from 'sentry/utils/queryString';
import {useApi} from 'sentry/utils/useApi';
import {useNavigate} from 'sentry/utils/useNavigate';
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
import {QueryCard} from './querycard';
import {
  getPrebuiltQueries,
  handleAddQueryToDashboard,
  SAVED_QUERY_DATASET_TO_WIDGET_TYPE,
} from './utils';

type Props = {
  location: Location;
  organization: Organization;
  pageLinks: string;
  refetchSavedQueries: () => void;
  renderPrebuilt: boolean;
  savedQueries: SavedQuery[];
  savedQuerySearchQuery: string;
};

type SavedQueryActions = ReturnType<typeof useSavedQueryActions>;

function getTimelineSubtitle(eventView: EventView) {
  if (eventView.statsPeriod) {
    return tct('Last [statsPeriod]', {statsPeriod: eventView.statsPeriod});
  }
  return (
    moment(eventView.start).format('MMM D, YYYY h:mm A') +
    ' - ' +
    moment(eventView.end).format('MMM D, YYYY h:mm A')
  );
}

function isDeprecatedTransactionQuery(
  organization: Organization,
  queryDataset: SavedQueryDatasets | undefined
) {
  return (
    organization.features.includes('discover-saved-queries-deprecation') &&
    queryDataset === SavedQueryDatasets.TRANSACTIONS
  );
}

function getWidgetType(
  organization: Organization,
  location: Location,
  query: SavedQuery | NewQuery
) {
  return hasDatasetSelector(organization)
    ? // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
      SAVED_QUERY_DATASET_TO_WIDGET_TYPE[
        getSavedQueryDataset(organization, location, query)
      ]
    : undefined;
}

function useSavedQueryActions({
  isLastQueryOnPage,
  location,
  organization,
  refetchSavedQueries,
}: {
  isLastQueryOnPage: boolean;
  location: Location;
  organization: Organization;
  refetchSavedQueries: () => void;
}) {
  const api = useApi();
  const navigate = useNavigate();

  const deleteQuery = (eventView: EventView) => {
    handleDeleteQuery(api, organization, eventView).then(() => {
      refetchSavedQueries();
      // Deleting the only query on a later page would leave the user on an empty page
      if (isLastQueryOnPage && location.query.cursor) {
        navigate({
          pathname: location.pathname,
          query: {...location.query, cursor: undefined},
        });
      }
    });
  };

  const duplicateQuery = (eventView: EventView, yAxis: string[]) => {
    const copy = eventView.clone();
    copy.name = `${copy.name} copy`;

    handleCreateQuery(api, organization, copy, yAxis).then(() => {
      refetchSavedQueries();
      navigate({
        pathname: location.pathname,
        query: {},
      });
    });
  };

  const setAsDefault = (eventView: EventView, type: 'prebuilt-query' | 'saved-query') => {
    handleUpdateHomepageQuery(api, organization, eventView.toNewQuery());
    trackAnalytics('discover_v2.set_as_default', {
      organization,
      source: 'context-menu',
      type,
    });
  };

  return {deleteQuery, duplicateQuery, setAsDefault};
}

function HamburgerDropdown({items}: {items: MenuItemProps[]}) {
  return (
    <DropdownMenu
      items={items}
      trigger={triggerProps => (
        <DropdownTrigger
          {...triggerProps}
          aria-label={t('Query actions')}
          size="xs"
          variant="transparent"
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

function PrebuiltQueryCard({
  actions,
  location,
  organization,
  view,
}: {
  actions: SavedQueryActions;
  location: Location;
  organization: Organization;
  view: NewQuery;
}) {
  const newQuery = getSavedQueryWithDataset(view)!;
  const eventView = EventView.fromNewQueryWithLocation(newQuery, location);

  const to = eventView.getResultsViewUrlTarget(
    organization,
    false,
    hasDatasetSelector(organization) ? view.queryDataset : undefined
  );

  const menuItems: MenuItemProps[] = [
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
          widgetType: getWidgetType(organization, location, newQuery),
          source: DashboardWidgetSource.DISCOVERV2,
        }),
      disabled: isDeprecatedTransactionQuery(organization, view.queryDataset),
    },
    {
      key: 'set-as-default',
      label: t('Set as Default'),
      onAction: () => actions.setAsDefault(eventView, 'prebuilt-query'),
    },
  ];

  return (
    <QueryCard
      to={to}
      title={eventView.name}
      subtitle={getTimelineSubtitle(eventView)}
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
          {({hasFeature}) => hasFeature && <HamburgerDropdown items={menuItems} />}
        </Feature>
      )}
    />
  );
}

function SavedQueryCard({
  actions,
  location,
  organization,
  query,
}: {
  actions: SavedQueryActions;
  location: Location;
  organization: Organization;
  query: SavedQuery;
}) {
  const savedQuery = getSavedQueryWithDataset(query)!;
  const eventView = EventView.fromSavedQuery(savedQuery);
  const deprecateTransactionQuery = isDeprecatedTransactionQuery(
    organization,
    savedQuery.queryDataset
  );

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
                widgetType: getWidgetType(organization, location, savedQuery),
                source: DashboardWidgetSource.DISCOVERV2,
              }),
            disabled: deprecateTransactionQuery,
          },
        ]
      : []),
    {
      key: 'set-as-default',
      label: t('Set as Default'),
      onAction: () => actions.setAsDefault(eventView, 'saved-query'),
    },
    {
      key: 'duplicate',
      label: t('Duplicate Query'),
      onAction: () => actions.duplicateQuery(eventView, decodeList(savedQuery.yAxis)),
      disabled: deprecateTransactionQuery,
    },
    {
      key: 'delete',
      label: t('Delete Query'),
      priority: 'danger',
      onAction: () => actions.deleteQuery(eventView),
    },
  ];

  return (
    <QueryCard
      to={eventView.getResultsViewShortUrlTarget(organization)}
      title={eventView.name}
      subtitle={getTimelineSubtitle(eventView)}
      queryDetail={eventView.query}
      createdBy={eventView.createdBy}
      dateStatus={<TimeSince date={savedQuery.dateUpdated} />}
      onEventClick={() => {
        trackAnalytics('discover_v2.saved_query_click', {organization});
      }}
      renderGraph={() => (
        <MiniGraph
          location={location}
          eventView={eventView}
          organization={organization}
          referrer={`api.discover.${eventView.getDisplayMode()}-chart`}
          yAxis={savedQuery.yAxis?.length ? savedQuery.yAxis : ['count()']}
        />
      )}
      renderContextMenu={() => (
        <Feature organization={organization} features="dashboards-edit">
          {({hasFeature}) => <HamburgerDropdown items={menuItems(hasFeature)} />}
        </Feature>
      )}
    />
  );
}

export function QueryList({
  location,
  organization,
  pageLinks,
  refetchSavedQueries,
  renderPrebuilt,
  savedQueries,
  savedQuerySearchQuery,
}: Props) {
  const navigate = useNavigate();
  const actions = useSavedQueryActions({
    isLastQueryOnPage: savedQueries.length === 1,
    location,
    organization,
    refetchSavedQueries,
  });

  useEffect(() => {
    /**
     * We need to reset global selection here because the saved queries can define their own projects
     * in the query. This can lead to mismatched queries for the project
     */
    resetPageFilters();
  }, []);

  // Pre-built queries are only shown on the first page of results
  const links = parseLinkHeader(pageLinks || '');
  const isFirstPage = !links.previous || links.previous.results === false;
  const needleSearch = savedQuerySearchQuery.toLowerCase();
  const prebuiltViews =
    renderPrebuilt && isFirstPage
      ? getPrebuiltQueries(organization).filter(
          view => !view.name || view.name.toLowerCase().includes(needleSearch)
        )
      : [];

  return (
    <Fragment>
      <Grid
        columns={{
          zero: 'minmax(100px, 1fr)',
          '3xl': 'repeat(2, minmax(100px, 1fr))',
          '4xl': 'repeat(3, minmax(100px, 1fr))',
        }}
        gap="xl"
      >
        {prebuiltViews.length === 0 && savedQueries.length === 0 ? (
          <StyledEmptyStateWarning>
            <p>{t('No saved queries match that filter')}</p>
          </StyledEmptyStateWarning>
        ) : (
          <Fragment>
            {prebuiltViews.map((view, index) => (
              <PrebuiltQueryCard
                key={`${index}-${view.name}`}
                actions={actions}
                location={location}
                organization={organization}
                view={view}
              />
            ))}
            {savedQueries.map((query, index) => (
              <SavedQueryCard
                key={`${index}-${query.id}`}
                actions={actions}
                location={location}
                organization={organization}
                query={query}
              />
            ))}
          </Fragment>
        )}
      </Grid>
      <PaginationRow
        pageLinks={pageLinks}
        onCursor={(cursor, path, query, direction) => {
          const offset = Number(cursor?.split(':')?.[1] ?? 0);

          const newQuery: Query & {cursor?: string} = {...query, cursor};
          const isPrevious = direction === -1;

          if (offset <= 0 && isPrevious) {
            delete newQuery.cursor;
          }

          navigate({
            pathname: path,
            query: newQuery,
          });
        }}
      />
    </Fragment>
  );
}

const PaginationRow = styled(Pagination)`
  margin-bottom: 20px;
`;

const DropdownTrigger = styled(Button)`
  transform: translateX(${p => p.theme.space.md});
`;

const StyledEmptyStateWarning = styled(EmptyStateWarning)`
  grid-column: 1 / 4;
`;
