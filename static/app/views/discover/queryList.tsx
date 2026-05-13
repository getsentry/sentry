import {Fragment, useEffect} from 'react';
import styled from '@emotion/styled';
import type {Query} from 'history';
import moment from 'moment-timezone';

import {Button} from '@sentry/scraps/button';
import {Pagination} from '@sentry/scraps/pagination';

import Feature from 'sentry/components/acl/feature';
import type {MenuItemProps} from 'sentry/components/dropdownMenu';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import {EmptyStateWarning} from 'sentry/components/emptyStateWarning';
import {resetPageFilters} from 'sentry/components/pageFilters/actions';
import {TimeSince} from 'sentry/components/timeSince';
import {IconEllipsis} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Organization, SavedQuery} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';
import {EventView} from 'sentry/utils/discover/eventView';
import {SavedQueryDatasets} from 'sentry/utils/discover/types';
import {parseLinkHeader} from 'sentry/utils/parseLinkHeader';
import {decodeList} from 'sentry/utils/queryString';
import {useApi} from 'sentry/utils/useApi';
import {useLocation} from 'sentry/utils/useLocation';
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
  organization: Organization;
  pageLinks: string;
  refetchSavedQueries: () => void;
  renderPrebuilt: boolean;
  savedQueries: SavedQuery[];
  savedQuerySearchQuery: string;
};

function QueryList({
  organization,
  pageLinks,
  refetchSavedQueries,
  renderPrebuilt,
  savedQueries,
  savedQuerySearchQuery,
}: Props) {
  const api = useApi();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    resetPageFilters();
  }, []);

  function handleDeleteSavedQuery(eventView: EventView) {
    handleDeleteQuery(api, organization, eventView).then(() => {
      refetchSavedQueries();
      if (savedQueries.length === 1 && location.query.cursor) {
        navigate({
          pathname: location.pathname,
          query: {...location.query, cursor: undefined},
        });
      }
    });
  }

  function handleDuplicateQuery(eventView: EventView, yAxis: string[]) {
    eventView = eventView.clone();
    eventView.name = `${eventView.name} copy`;

    handleCreateQuery(api, organization, eventView, yAxis).then(() => {
      refetchSavedQueries();
      navigate({
        pathname: location.pathname,
        query: {},
      });
    });
  }

  function renderDropdownMenu(items: MenuItemProps[]) {
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

  function renderPrebuiltQueries() {
    const views = getPrebuiltQueries(organization);

    const hasSearchQuery =
      typeof savedQuerySearchQuery === 'string' && savedQuerySearchQuery.length > 0;
    const needleSearch = hasSearchQuery ? savedQuerySearchQuery.toLowerCase() : '';

    const list = views.map((view, index) => {
      const newQuery = getSavedQueryWithDataset(view)!;
      const eventView = EventView.fromNewQueryWithLocation(newQuery, location);

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
        organization,
        false,
        hasDatasetSelector(organization) ? view.queryDataset : undefined
      );

      const deprecateTransactionQuery =
        organization.features.includes('discover-saved-queries-deprecation') &&
        view.queryDataset === SavedQueryDatasets.TRANSACTIONS;

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
              widgetType: hasDatasetSelector(organization)
                ? // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
                  SAVED_QUERY_DATASET_TO_WIDGET_TYPE[
                    getSavedQueryDataset(organization, location, newQuery)
                  ]
                : undefined,
              source: DashboardWidgetSource.DISCOVERV2,
            }),
          disabled: deprecateTransactionQuery,
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
                return hasFeature && renderDropdownMenu(menuItems);
              }}
            </Feature>
          )}
        />
      );
    });

    return list;
  }

  function renderSavedQueries() {
    if (!savedQueries || !Array.isArray(savedQueries) || savedQueries.length === 0) {
      return [];
    }

    return savedQueries.map((query, index) => {
      const savedQuery = getSavedQueryWithDataset(query)!;
      const eventView = EventView.fromSavedQuery(savedQuery);
      const recentTimeline = t('Last ') + eventView.statsPeriod;
      const customTimeline =
        moment(eventView.start).format('MMM D, YYYY h:mm A') +
        ' - ' +
        moment(eventView.end).format('MMM D, YYYY h:mm A');

      const to = eventView.getResultsViewShortUrlTarget(organization);
      const dateStatus = <TimeSince date={savedQuery.dateUpdated} />;
      const referrer = `api.discover.${eventView.getDisplayMode()}-chart`;

      const deprecateTransactionQuery =
        organization.features.includes('discover-saved-queries-deprecation') &&
        savedQuery.queryDataset === SavedQueryDatasets.TRANSACTIONS;

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
                    widgetType: hasDatasetSelector(organization)
                      ? // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
                        SAVED_QUERY_DATASET_TO_WIDGET_TYPE[
                          getSavedQueryDataset(organization, location, savedQuery)
                        ]
                      : undefined,
                    source: DashboardWidgetSource.DISCOVERV2,
                  }),
                disabled: deprecateTransactionQuery,
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
            handleDuplicateQuery(eventView, decodeList(savedQuery.yAxis)),
          disabled: deprecateTransactionQuery,
        },
        {
          key: 'delete',
          label: t('Delete Query'),
          priority: 'danger',
          onAction: () => handleDeleteSavedQuery(eventView),
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
              {({hasFeature}) => renderDropdownMenu(menuItems(hasFeature))}
            </Feature>
          )}
        />
      );
    });
  }

  function renderAllQueries() {
    const links = parseLinkHeader(pageLinks || '');
    let cards: React.ReactNode[] = [];

    if (renderPrebuilt && (!links.previous || links.previous.results === false)) {
      cards = cards.concat(renderPrebuiltQueries());
    }
    cards = cards.concat(renderSavedQueries());

    if (cards.filter(Boolean).length === 0) {
      return (
        <StyledEmptyStateWarning>
          <p>{t('No saved queries match that filter')}</p>
        </StyledEmptyStateWarning>
      );
    }

    return cards;
  }

  return (
    <Fragment>
      <QueryGrid>{renderAllQueries()}</QueryGrid>
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

const QueryGrid = styled('div')`
  display: grid;
  grid-template-columns: minmax(100px, 1fr);
  gap: ${p => p.theme.space.xl};

  @media (min-width: ${p => p.theme.breakpoints.md}) {
    grid-template-columns: repeat(2, minmax(100px, 1fr));
  }

  @media (min-width: ${p => p.theme.breakpoints.lg}) {
    grid-template-columns: repeat(3, minmax(100px, 1fr));
  }
`;

const DropdownTrigger = styled(Button)`
  transform: translateX(${p => p.theme.space.md});
`;

const StyledEmptyStateWarning = styled(EmptyStateWarning)`
  grid-column: 1 / 4;
`;

export {QueryList};
