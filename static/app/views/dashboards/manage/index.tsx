import {useEffect, useMemo, useRef, useState} from 'react';
import styled from '@emotion/styled';
import type {Query} from 'history';
import debounce from 'lodash/debounce';
import pick from 'lodash/pick';

import {createDashboard} from 'sentry/actionCreators/dashboards';
import {addLoadingMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {openImportDashboardFromFileModal} from 'sentry/actionCreators/modal';
import Feature from 'sentry/components/acl/feature';
import {Alert} from 'sentry/components/core/alert';
import {Button} from 'sentry/components/core/button';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import {CompactSelect} from 'sentry/components/core/compactSelect';
import {SegmentedControl} from 'sentry/components/core/segmentedControl';
import {Switch} from 'sentry/components/core/switch';
import ErrorBoundary from 'sentry/components/errorBoundary';
import FeedbackButton from 'sentry/components/feedbackButton/feedbackButton';
import * as Layout from 'sentry/components/layouts/thirds';
import NoProjectMessage from 'sentry/components/noProjectMessage';
import {PageHeadingQuestionTooltip} from 'sentry/components/pageHeadingQuestionTooltip';
import Pagination from 'sentry/components/pagination';
import SearchBar from 'sentry/components/searchBar';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {IconAdd, IconGrid, IconList} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';
import localStorage from 'sentry/utils/localStorage';
import parseLinkHeader from 'sentry/utils/parseLinkHeader';
import {useApiQuery} from 'sentry/utils/queryClient';
import {decodeScalar} from 'sentry/utils/queryString';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import useApi from 'sentry/utils/useApi';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {DashboardCreateLimitWrapper} from 'sentry/views/dashboards/createLimitWrapper';
import {getDashboardTemplates} from 'sentry/views/dashboards/data';
import {useOwnedDashboards} from 'sentry/views/dashboards/hooks/useOwnedDashboards';
import {
  assignDefaultLayout,
  getInitialColumnDepths,
} from 'sentry/views/dashboards/layoutUtils';
import DashboardTable from 'sentry/views/dashboards/manage/dashboardTable';
import OwnedDashboardsTable, {
  OWNED_CURSOR_KEY,
} from 'sentry/views/dashboards/manage/tableView/ownedDashboardsTable';
import type {DashboardsLayout} from 'sentry/views/dashboards/manage/types';
import type {DashboardDetails, DashboardListItem} from 'sentry/views/dashboards/types';
import {PREBUILT_DASHBOARDS} from 'sentry/views/dashboards/utils/prebuiltConfigs';
import RouteError from 'sentry/views/routeError';

import DashboardGrid from './dashboardGrid';
import {
  DASHBOARD_CARD_GRID_PADDING,
  DASHBOARD_GRID_DEFAULT_NUM_CARDS,
  DASHBOARD_GRID_DEFAULT_NUM_COLUMNS,
  DASHBOARD_GRID_DEFAULT_NUM_ROWS,
  DASHBOARD_TABLE_NUM_ROWS,
  MINIMUM_DASHBOARD_CARD_WIDTH,
} from './settings';
import TemplateCard from './templateCard';

const SHOW_TEMPLATES_KEY = 'dashboards-show-templates';
export const LAYOUT_KEY = 'dashboards-overview-layout';

const GRID = 'grid';
const TABLE = 'table';

function shouldShowTemplates(): boolean {
  const shouldShow = localStorage.getItem(SHOW_TEMPLATES_KEY);
  return shouldShow === 'true' || shouldShow === null;
}

function getDashboardsOverviewLayout(): DashboardsLayout {
  const dashboardsLayout = localStorage.getItem(LAYOUT_KEY);

  // There was a bug where the layout was saved as 'list' instead of 'table'
  // this coerces it back to TABLE in case we still rely on it anywhere
  if (dashboardsLayout === 'list') {
    return TABLE;
  }

  return dashboardsLayout === GRID || dashboardsLayout === TABLE
    ? dashboardsLayout
    : GRID;
}

function getSortOptions({
  organization,
  dashboardsLayout,
}: {
  dashboardsLayout: DashboardsLayout;
  organization: Organization;
}) {
  return [
    ...(!organization.features.includes('dashboards-starred-reordering') ||
    dashboardsLayout === GRID
      ? [{label: t('My Dashboards'), value: 'mydashboards'}]
      : []),
    {label: t('Dashboard Name (A-Z)'), value: 'title'},
    {label: t('Dashboard Name (Z-A)'), value: '-title'},
    {label: t('Date Created (Newest)'), value: '-dateCreated'},
    {label: t('Date Created (Oldest)'), value: 'dateCreated'},
    {label: t('Most Popular'), value: 'mostPopular'},
    ...(organization.features.includes('dashboards-starred-reordering')
      ? [{label: t('Most Starred'), value: 'mostFavorited'}]
      : []),
    {label: t('Recently Viewed'), value: 'recentlyViewed'},
  ];
}

function getDefaultSort({
  organization,
  dashboardsLayout,
}: {
  dashboardsLayout: DashboardsLayout;
  organization: Organization;
}) {
  if (
    organization.features.includes('dashboards-starred-reordering') &&
    dashboardsLayout === TABLE
  ) {
    return 'recentlyViewed';
  }

  return 'mydashboards';
}

function ManageDashboards() {
  const organization = useOrganization();
  const navigate = useNavigate();
  const location = useLocation();
  const api = useApi();
  const dashboardGridRef = useRef<HTMLDivElement>(null);

  const [showTemplates, setShowTemplatesLocal] = useLocalStorageState(
    SHOW_TEMPLATES_KEY,
    shouldShowTemplates()
  );
  const [dashboardsLayout, setDashboardsLayout] = useLocalStorageState(
    LAYOUT_KEY,
    getDashboardsOverviewLayout()
  );
  const [{rowCount, columnCount}, setGridSize] = useState({
    rowCount: DASHBOARD_GRID_DEFAULT_NUM_ROWS,
    columnCount: DASHBOARD_GRID_DEFAULT_NUM_COLUMNS,
  });

  const sortOptions = getSortOptions({
    organization,
    dashboardsLayout,
  });

  const {
    data: dashboardsWithoutPrebuiltConfigs,
    isLoading,
    isError,
    error,
    getResponseHeader,
    refetch: refetchDashboards,
  } = useApiQuery<DashboardListItem[]>(
    [
      `/organizations/${organization.slug}/dashboards/`,
      {
        query: {
          ...pick(location.query, ['cursor', 'query']),
          sort: getActiveSort()!.value,
          pin: 'favorites',
          per_page:
            dashboardsLayout === GRID ? rowCount * columnCount : DASHBOARD_TABLE_NUM_ROWS,
        },
      },
    ],
    {
      staleTime: 0,
      enabled: !(
        organization.features.includes('dashboards-starred-reordering') &&
        dashboardsLayout === TABLE
      ),
    }
  );

  const dashboards = useMemo(
    () =>
      dashboardsWithoutPrebuiltConfigs?.map(dashboard => {
        if (dashboard.prebuiltId && dashboard.prebuiltId in PREBUILT_DASHBOARDS) {
          return {
            ...dashboard,
            widgetDisplay: PREBUILT_DASHBOARDS[dashboard.prebuiltId].widgets.map(
              widget => widget.displayType
            ),
            widgetPreview: PREBUILT_DASHBOARDS[dashboard.prebuiltId].widgets.map(
              widget => ({
                displayType: widget.displayType,
                layout: widget.layout ?? null,
              })
            ),
            projects: [],
          };
        }
        return dashboard;
      }),
    [dashboardsWithoutPrebuiltConfigs]
  );

  const ownedDashboards = useOwnedDashboards({
    query: decodeScalar(location.query.query, ''),
    cursor: decodeScalar(location.query[OWNED_CURSOR_KEY], ''),
    sort: getActiveSort()!.value,
    enabled:
      organization.features.includes('dashboards-starred-reordering') &&
      dashboardsLayout === TABLE,
  });

  const dashboardsPageLinks = getResponseHeader?.('Link') ?? '';

  function setRowsAndColumns(containerWidth: number) {
    const numWidgetsFitInRow = Math.floor(
      containerWidth / (MINIMUM_DASHBOARD_CARD_WIDTH + DASHBOARD_CARD_GRID_PADDING)
    );

    if (numWidgetsFitInRow >= 3) {
      setGridSize({
        rowCount: DASHBOARD_GRID_DEFAULT_NUM_ROWS,
        columnCount: numWidgetsFitInRow,
      });
    } else if (numWidgetsFitInRow === 0) {
      setGridSize({
        rowCount: DASHBOARD_GRID_DEFAULT_NUM_CARDS,
        columnCount: 1,
      });
    } else {
      setGridSize({
        rowCount: DASHBOARD_GRID_DEFAULT_NUM_CARDS / numWidgetsFitInRow,
        columnCount: numWidgetsFitInRow,
      });
    }
  }

  useEffect(() => {
    const dashboardGridObserver = new ResizeObserver(
      debounce(entries => {
        entries.forEach((entry: any) => {
          const currentWidth = entry.contentRect.width;

          setRowsAndColumns(currentWidth);

          const paginationObject = parseLinkHeader(dashboardsPageLinks);
          if (
            dashboards?.length &&
            paginationObject?.next &&
            paginationObject?.next?.results &&
            rowCount * columnCount > dashboards.length
          ) {
            refetchDashboards();
          }
        });
      }, 10)
    );

    const currentDashboardGrid = dashboardGridRef.current;

    if (currentDashboardGrid) {
      dashboardGridObserver.observe(currentDashboardGrid);
    }

    return () => {
      if (currentDashboardGrid) {
        dashboardGridObserver.unobserve(currentDashboardGrid);
      }
    };
  }, [columnCount, dashboards?.length, dashboardsPageLinks, refetchDashboards, rowCount]);

  useEffect(() => {
    const urlSort = decodeScalar(location.query.sort);
    const defaultSort = getDefaultSort({
      organization,
      dashboardsLayout,
    });
    if (urlSort && !sortOptions.some(option => option.value === urlSort)) {
      // The sort option is not valid, so we need to set the default sort
      // in the URL
      navigate({
        pathname: location.pathname,
        query: {...location.query, sort: defaultSort},
      });
    }
  }, [
    dashboardsLayout,
    location.pathname,
    location.query,
    navigate,
    organization,
    sortOptions,
  ]);

  function getActiveSort() {
    const defaultSort = getDefaultSort({
      organization,
      dashboardsLayout,
    });
    const urlSort = decodeScalar(location.query.sort, defaultSort);

    if (urlSort) {
      // Check if the URL sort is valid
      const foundSort = sortOptions.find(item => item.value === urlSort);
      if (foundSort) {
        return foundSort;
      }
    }

    // If it is not valid, try the default sort, and only if that is not valid, use the first option
    return sortOptions.find(item => item.value === defaultSort) || sortOptions[0];
  }

  function handleSearch(query: string) {
    trackAnalytics('dashboards_manage.search', {
      organization,
    });

    navigate({
      pathname: location.pathname,
      query: {...location.query, cursor: undefined, query},
    });
  }

  const handleSortChange = (value: string) => {
    trackAnalytics('dashboards_manage.change_sort', {
      organization,
      sort: value,
    });
    navigate({
      pathname: location.pathname,
      query: {
        ...location.query,
        cursor: undefined,
        sort: value,
      },
    });
  };

  const toggleTemplates = () => {
    trackAnalytics('dashboards_manage.templates.toggle', {
      organization,
      show_templates: !showTemplates,
    });

    setShowTemplatesLocal(!showTemplates);
  };

  function getQuery() {
    const {query} = location.query;

    return typeof query === 'string' ? query : undefined;
  }

  function renderTemplates() {
    return (
      <TemplateContainer>
        {getDashboardTemplates(organization).map(dashboard => (
          <TemplateCard
            title={dashboard.title}
            description={dashboard.description}
            onPreview={() => onPreview(dashboard.id)}
            onAdd={() => onAdd(dashboard)}
            key={dashboard.title}
          />
        ))}
      </TemplateContainer>
    );
  }

  function renderActions() {
    const activeSort = getActiveSort();
    return (
      <StyledActions>
        <SearchBar
          defaultQuery=""
          query={getQuery()}
          placeholder={t('Search Dashboards')}
          onSearch={query => handleSearch(query)}
        />
        <SegmentedControl<DashboardsLayout>
          onChange={newValue => {
            setDashboardsLayout(newValue);
            trackAnalytics('dashboards_manage.change_view_type', {
              organization,
              view_type: newValue,
            });
          }}
          size="md"
          value={dashboardsLayout}
          aria-label={t('Layout Control')}
        >
          <SegmentedControl.Item
            key={GRID}
            textValue={GRID}
            aria-label={t('Grid View')}
            icon={<IconGrid />}
          />
          <SegmentedControl.Item
            key={TABLE}
            textValue={TABLE}
            aria-label={t('List View')}
            icon={<IconList />}
          />
        </SegmentedControl>
        <CompactSelect
          triggerProps={{prefix: t('Sort By')}}
          value={activeSort!.value}
          options={sortOptions}
          onChange={opt => handleSortChange(opt.value)}
          position="bottom-end"
          data-test-id="sort-by-select"
        />
      </StyledActions>
    );
  }

  function renderNoAccess() {
    return (
      <Layout.Page>
        <Alert.Container>
          <Alert variant="warning" showIcon={false}>
            {t("You don't have access to this feature")}
          </Alert>
        </Alert.Container>
      </Layout.Page>
    );
  }

  function renderDashboards() {
    return dashboardsLayout === GRID ? (
      <DashboardGrid
        api={api}
        dashboards={dashboards}
        organization={organization}
        location={location}
        onDashboardsChange={() => refetchDashboards()}
        isLoading={isLoading}
        rowCount={rowCount}
        columnCount={columnCount}
      />
    ) : organization.features.includes('dashboards-starred-reordering') ? (
      <OwnedDashboardsTable
        dashboards={ownedDashboards.data ?? []}
        isLoading={ownedDashboards.isLoading}
        pageLinks={ownedDashboards.getResponseHeader?.('Link') ?? undefined}
      />
    ) : (
      <DashboardTable
        api={api}
        dashboards={dashboards}
        organization={organization}
        location={location}
        onDashboardsChange={() => refetchDashboards()}
        isLoading={isLoading}
      />
    );
  }

  function renderPagination() {
    return (
      <PaginationRow
        pageLinks={dashboardsPageLinks}
        onCursor={(cursor, path, query, direction) => {
          const offset = Number(cursor?.split?.(':')?.[1] ?? 0);

          const newQuery: Query & {cursor?: string} = {...query, cursor};
          const isPrevious = direction === -1;

          if (offset <= 0 && isPrevious) {
            delete newQuery.cursor;
          }

          trackAnalytics('dashboards_manage.paginate', {organization});

          navigate({
            pathname: path,
            query: newQuery,
          });
        }}
      />
    );
  }

  function onCreate() {
    trackAnalytics('dashboards_manage.create.start', {
      organization,
    });

    navigate(
      normalizeUrl({
        pathname: `/organizations/${organization.slug}/dashboards/new/`,
        query: location.query,
      })
    );
  }

  async function onAdd(dashboard: DashboardDetails) {
    trackAnalytics('dashboards_manage.templates.add', {
      organization,
      dashboard_id: dashboard.id,
      dashboard_title: dashboard.title,
      was_previewed: false,
    });

    addLoadingMessage(t('Adding dashboard from template...'));

    const newDashboard = await createDashboard(
      api,
      organization.slug,
      {
        ...dashboard,
        widgets: assignDefaultLayout(dashboard.widgets, getInitialColumnDepths()),
      },
      true
    );
    addSuccessMessage(`${dashboard.title} dashboard template successfully added.`);
    loadDashboard(newDashboard.id);
  }

  function loadDashboard(dashboardId: string) {
    navigate(
      normalizeUrl({
        pathname: `/organizations/${organization.slug}/dashboards/${dashboardId}/`,
        query: location.query,
      })
    );
  }

  function onPreview(dashboardId: string) {
    trackAnalytics('dashboards_manage.templates.preview', {
      organization,
      dashboard_id: dashboardId,
    });

    navigate(
      normalizeUrl({
        pathname: `/organizations/${organization.slug}/dashboards/new/${dashboardId}/`,
        query: location.query,
      })
    );
  }

  return (
    <Feature
      organization={organization}
      features="dashboards-edit"
      renderDisabled={renderNoAccess}
    >
      <SentryDocumentTitle title={t('All Dashboards')} orgSlug={organization.slug}>
        <ErrorBoundary>
          {isError ? (
            <Layout.Page withPadding>
              <RouteError error={error} />
            </Layout.Page>
          ) : (
            <Layout.Page>
              <NoProjectMessage organization={organization}>
                <Layout.Header unified>
                  <Layout.HeaderContent unified>
                    <Layout.Title>
                      {t('All Dashboards')}
                      <PageHeadingQuestionTooltip
                        docsUrl="https://docs.sentry.io/product/dashboards/"
                        title={t(
                          'A broad overview of your application’s health where you can navigate through error and performance data across multiple projects.'
                        )}
                      />
                    </Layout.Title>
                  </Layout.HeaderContent>
                  <Layout.HeaderActions>
                    <ButtonBar gap="lg">
                      <TemplateSwitch>
                        {t('Show Templates')}
                        <Switch
                          checked={showTemplates}
                          size="lg"
                          onChange={toggleTemplates}
                        />
                      </TemplateSwitch>
                      <FeedbackButton />
                      <DashboardCreateLimitWrapper>
                        {({
                          hasReachedDashboardLimit,
                          isLoading: isLoadingDashboardsLimit,
                          limitMessage,
                        }) => (
                          <Button
                            data-test-id="dashboard-create"
                            onClick={event => {
                              event.preventDefault();
                              onCreate();
                            }}
                            size="sm"
                            priority="primary"
                            icon={<IconAdd />}
                            disabled={
                              hasReachedDashboardLimit || isLoadingDashboardsLimit
                            }
                            title={limitMessage}
                            tooltipProps={{
                              isHoverable: true,
                            }}
                          >
                            {t('Create Dashboard')}
                          </Button>
                        )}
                      </DashboardCreateLimitWrapper>
                      <Feature features="dashboards-import">
                        <Button
                          onClick={() => {
                            openImportDashboardFromFileModal({
                              organization,
                              api,
                              location,
                            });
                          }}
                          size="sm"
                          priority="primary"
                          icon={<IconAdd />}
                        >
                          {t('Import Dashboard from JSON')}
                        </Button>
                      </Feature>
                    </ButtonBar>
                  </Layout.HeaderActions>
                </Layout.Header>
                <Layout.Body>
                  <Layout.Main width="full">
                    {showTemplates && renderTemplates()}
                    {renderActions()}
                    <div ref={dashboardGridRef} id="dashboard-list-container">
                      {renderDashboards()}
                    </div>
                    {!(
                      organization.features.includes('dashboards-starred-reordering') &&
                      dashboardsLayout === TABLE
                    ) && renderPagination()}
                  </Layout.Main>
                </Layout.Body>
              </NoProjectMessage>
            </Layout.Page>
          )}
        </ErrorBoundary>
      </SentryDocumentTitle>
    </Feature>
  );
}

const StyledActions = styled('div')`
  display: grid;
  grid-template-columns: auto max-content max-content;
  gap: ${space(2)};
  margin-bottom: ${space(2)};

  @media (max-width: ${p => p.theme.breakpoints.sm}) {
    grid-template-columns: auto;
  }
`;

const TemplateSwitch = styled('label')`
  font-weight: ${p => p.theme.fontWeight.normal};
  font-size: ${p => p.theme.fontSize.lg};
  display: flex;
  align-items: center;
  gap: ${space(1)};
  width: max-content;
  margin: 0;
`;

const TemplateContainer = styled('div')`
  display: grid;
  gap: ${space(2)};
  margin-bottom: ${space(0.5)};

  @media (min-width: ${p => p.theme.breakpoints.sm}) {
    grid-template-columns: repeat(2, minmax(200px, 1fr));
  }

  @media (min-width: ${p => p.theme.breakpoints.lg}) {
    grid-template-columns: repeat(4, minmax(200px, 1fr));
  }
`;

const PaginationRow = styled(Pagination)`
  margin-bottom: ${space(3)};
`;

export default ManageDashboards;
