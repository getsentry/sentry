import {useEffect, useRef, useState} from 'react';
import styled from '@emotion/styled';
import type {Query} from 'history';
import debounce from 'lodash/debounce';
import pick from 'lodash/pick';

import {createDashboard} from 'sentry/actionCreators/dashboards';
import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import {openImportDashboardFromFileModal} from 'sentry/actionCreators/modal';
import Feature from 'sentry/components/acl/feature';
import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import {CompactSelect} from 'sentry/components/compactSelect';
import {Alert} from 'sentry/components/core/alert';
import {Switch} from 'sentry/components/core/switch';
import ErrorBoundary from 'sentry/components/errorBoundary';
import FeedbackWidgetButton from 'sentry/components/feedback/widget/feedbackWidgetButton';
import * as Layout from 'sentry/components/layouts/thirds';
import {usePrefersStackedNav} from 'sentry/components/nav/prefersStackedNav';
import NoProjectMessage from 'sentry/components/noProjectMessage';
import {PageHeadingQuestionTooltip} from 'sentry/components/pageHeadingQuestionTooltip';
import Pagination from 'sentry/components/pagination';
import SearchBar from 'sentry/components/searchBar';
import {SegmentedControl} from 'sentry/components/segmentedControl';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {IconAdd, IconGrid, IconList} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {SelectValue} from 'sentry/types/core';
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
import DashboardTable from 'sentry/views/dashboards/manage/dashboardTable';
import type {DashboardsLayout} from 'sentry/views/dashboards/manage/types';
import RouteError from 'sentry/views/routeError';

import {getDashboardTemplates} from '../data';
import {assignDefaultLayout, getInitialColumnDepths} from '../layoutUtils';
import type {DashboardDetails, DashboardListItem} from '../types';

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

const SORT_OPTIONS: Array<SelectValue<string>> = [
  {label: t('My Dashboards'), value: 'mydashboards'},
  {label: t('Dashboard Name (A-Z)'), value: 'title'},
  {label: t('Dashboard Name (Z-A)'), value: '-title'},
  {label: t('Date Created (Newest)'), value: '-dateCreated'},
  {label: t('Date Created (Oldest)'), value: 'dateCreated'},
  {label: t('Most Popular'), value: 'mostPopular'},
  {label: t('Recently Viewed'), value: 'recentlyViewed'},
];

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
  return dashboardsLayout === GRID || dashboardsLayout === TABLE
    ? dashboardsLayout
    : GRID;
}

function ManageDashboards() {
  const organization = useOrganization();
  const navigate = useNavigate();
  const location = useLocation();
  const api = useApi();
  const dashboardGridRef = useRef<HTMLDivElement>(null);
  const prefersStackedNav = usePrefersStackedNav();

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

  const {
    data: dashboards,
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
          ...(organization.features.includes('dashboards-favourite')
            ? {pin: 'favorites'}
            : {}),
          per_page:
            dashboardsLayout === GRID ? rowCount * columnCount : DASHBOARD_TABLE_NUM_ROWS,
        },
      },
    ],
    {staleTime: 0}
  );

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
            paginationObject.next!.results &&
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

  function getActiveSort() {
    const urlSort = decodeScalar(location.query.sort, 'mydashboards');
    return SORT_OPTIONS.find(item => item.value === urlSort) || SORT_OPTIONS[0];
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
      <StyledActions listView={organization.features.includes('dashboards-table-view')}>
        <SearchBar
          defaultQuery=""
          query={getQuery()}
          placeholder={t('Search Dashboards')}
          onSearch={query => handleSearch(query)}
        />
        <Feature features={'organizations:dashboards-table-view'}>
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
              key="grid"
              textValue="grid"
              aria-label={t('Grid View')}
              icon={<IconGrid />}
            />
            <SegmentedControl.Item
              key="list"
              textValue="list"
              aria-label={t('List View')}
              icon={<IconList />}
            />
          </SegmentedControl>
        </Feature>
        <CompactSelect
          triggerProps={{prefix: t('Sort By')}}
          value={activeSort!.value}
          options={SORT_OPTIONS}
          onChange={opt => handleSortChange(opt.value)}
          position="bottom-end"
        />
      </StyledActions>
    );
  }

  function renderNoAccess() {
    return (
      <Layout.Page>
        <Alert.Container>
          <Alert type="warning">{t("You don't have access to this feature")}</Alert>
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
      <SentryDocumentTitle title={t('Dashboards')} orgSlug={organization.slug}>
        <ErrorBoundary>
          {isError ? (
            <Layout.Page withPadding>
              <RouteError error={error} />
            </Layout.Page>
          ) : (
            <Layout.Page>
              <NoProjectMessage organization={organization}>
                <Layout.Header unified={prefersStackedNav}>
                  <Layout.HeaderContent unified={prefersStackedNav}>
                    <Layout.Title>
                      {t('Dashboards')}
                      <PageHeadingQuestionTooltip
                        docsUrl="https://docs.sentry.io/product/dashboards/"
                        title={t(
                          'A broad overview of your application’s health where you can navigate through error and performance data across multiple projects.'
                        )}
                      />
                    </Layout.Title>
                  </Layout.HeaderContent>
                  <Layout.HeaderActions>
                    <ButtonBar gap={1.5}>
                      <TemplateSwitch>
                        {t('Show Templates')}
                        <Switch
                          checked={showTemplates}
                          size="lg"
                          onClick={toggleTemplates}
                        />
                      </TemplateSwitch>
                      <FeedbackWidgetButton />
                      <Button
                        data-test-id="dashboard-create"
                        onClick={event => {
                          event.preventDefault();
                          onCreate();
                        }}
                        size="sm"
                        priority="primary"
                        icon={<IconAdd isCircled />}
                      >
                        {t('Create Dashboard')}
                      </Button>
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
                          icon={<IconAdd isCircled />}
                        >
                          {t('Import Dashboard from JSON')}
                        </Button>
                      </Feature>
                    </ButtonBar>
                  </Layout.HeaderActions>
                </Layout.Header>
                <Layout.Body>
                  <Layout.Main fullWidth>
                    {showTemplates && renderTemplates()}
                    {renderActions()}
                    <div ref={dashboardGridRef} id="dashboard-list-container">
                      {renderDashboards()}
                    </div>
                    {renderPagination()}
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

const StyledActions = styled('div')<{listView: boolean}>`
  display: grid;
  grid-template-columns: ${p =>
    p.listView ? 'auto max-content max-content' : 'auto max-content'};
  gap: ${space(2)};
  margin-bottom: ${space(2)};

  @media (max-width: ${p => p.theme.breakpoints.small}) {
    grid-template-columns: auto;
  }
`;

const TemplateSwitch = styled('label')`
  font-weight: ${p => p.theme.fontWeightNormal};
  font-size: ${p => p.theme.fontSizeLarge};
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

  @media (min-width: ${p => p.theme.breakpoints.small}) {
    grid-template-columns: repeat(2, minmax(200px, 1fr));
  }

  @media (min-width: ${p => p.theme.breakpoints.large}) {
    grid-template-columns: repeat(4, minmax(200px, 1fr));
  }
`;

const PaginationRow = styled(Pagination)`
  margin-bottom: ${space(3)};
`;

export default ManageDashboards;
