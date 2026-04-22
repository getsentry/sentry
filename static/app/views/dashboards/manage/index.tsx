import {Fragment, useEffect, useMemo, useRef, useState} from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';
import {useQuery} from '@tanstack/react-query';
import type {Query} from 'history';
import debounce from 'lodash/debounce';
import pick from 'lodash/pick';

import {Alert} from '@sentry/scraps/alert';
import {FeatureBadge} from '@sentry/scraps/badge';
import {Button} from '@sentry/scraps/button';
import {CompactSelect} from '@sentry/scraps/compactSelect';
import {Flex, Grid, Stack} from '@sentry/scraps/layout';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';
import {SegmentedControl} from '@sentry/scraps/segmentedControl';

import {openImportDashboardFromFileModal} from 'sentry/actionCreators/modal';
import Feature from 'sentry/components/acl/feature';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import {ErrorBoundary} from 'sentry/components/errorBoundary';
import {FeedbackButton} from 'sentry/components/feedbackButton/feedbackButton';
import * as Layout from 'sentry/components/layouts/thirds';
import {NoProjectMessage} from 'sentry/components/noProjectMessage';
import {PageHeadingQuestionTooltip} from 'sentry/components/pageHeadingQuestionTooltip';
import {Pagination} from 'sentry/components/pagination';
import {SearchBar} from 'sentry/components/searchBar';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {IconAdd, IconGrid, IconList} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';
import {selectJsonWithHeaders} from 'sentry/utils/api/apiOptions';
import {dashboardsApiOptions} from 'sentry/utils/dashboards/dashboardsApiOptions';
import {localStorageWrapper} from 'sentry/utils/localStorage';
import {parseLinkHeader} from 'sentry/utils/parseLinkHeader';
import {decodeScalar} from 'sentry/utils/queryString';
import {scheduleMicroTask} from 'sentry/utils/scheduleMicroTask';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useApi} from 'sentry/utils/useApi';
import {useHasProjectAccess} from 'sentry/utils/useHasProjectAccess';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {DashboardCreateLimitWrapper} from 'sentry/views/dashboards/createLimitWrapper';
import {useOwnedDashboards} from 'sentry/views/dashboards/hooks/useOwnedDashboards';
import DashboardTable from 'sentry/views/dashboards/manage/dashboardTable';
import {
  OWNED_CURSOR_KEY,
  OwnedDashboardsTable,
} from 'sentry/views/dashboards/manage/tableView/ownedDashboardsTable';
import type {DashboardsLayout} from 'sentry/views/dashboards/manage/types';
import {DashboardFilter, PREBUILT_DASHBOARD_LABEL} from 'sentry/views/dashboards/types';
import {PREBUILT_DASHBOARDS} from 'sentry/views/dashboards/utils/prebuiltConfigs';
import {TopBar} from 'sentry/views/navigation/topBar';
import {useHasPageFrameFeature} from 'sentry/views/navigation/useHasPageFrameFeature';
import RouteError from 'sentry/views/routeError';

import DashboardGrid from './dashboardGrid';
import {
  DASHBOARD_CARD_GRID_PADDING,
  DASHBOARD_GRID_DEFAULT_NUM_CARDS,
  DASHBOARD_GRID_DEFAULT_NUM_COLUMNS,
  DASHBOARD_GRID_DEFAULT_NUM_ROWS,
  DASHBOARD_TABLE_NUM_ROWS,
  DEFAULT_PREBUILT_SORT,
  MINIMUM_DASHBOARD_CARD_WIDTH,
} from './settings';

export const LAYOUT_KEY = 'dashboards-overview-layout';

const GRID = 'grid';
const TABLE = 'table';

function getDashboardsOverviewLayout(): DashboardsLayout {
  const dashboardsLayout = localStorageWrapper.getItem(LAYOUT_KEY);

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
  isOnlyPrebuilt,
}: {
  dashboardsLayout: DashboardsLayout;
  isOnlyPrebuilt: boolean;
  organization: Organization;
}) {
  const options = [];

  if (
    !isOnlyPrebuilt &&
    (!organization.features.includes('dashboards-starred-reordering') ||
      dashboardsLayout === GRID)
  ) {
    options.push({label: t('My Dashboards'), value: 'mydashboards'});
  }

  options.push(
    {label: t('Dashboard Name (A-Z)'), value: 'title'},
    {label: t('Dashboard Name (Z-A)'), value: '-title'},
    {label: t('Date Created (Newest)'), value: '-dateCreated'},
    {label: t('Date Created (Oldest)'), value: 'dateCreated'},
    {label: t('Most Popular'), value: 'mostPopular'}
  );

  if (organization.features.includes('dashboards-starred-reordering')) {
    options.push({label: t('Most Starred'), value: 'mostFavorited'});
  }

  options.push({label: t('Recently Viewed'), value: 'recentlyViewed'});

  return options;
}

function getDefaultSort({
  organization,
  dashboardsLayout,
  isOnlyPrebuilt,
}: {
  dashboardsLayout: DashboardsLayout;
  isOnlyPrebuilt: boolean;
  organization: Organization;
}) {
  if (isOnlyPrebuilt) {
    return DEFAULT_PREBUILT_SORT;
  }

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
  const hasPageFrameFeature = useHasPageFrameFeature();
  const dashboardGridRef = useRef<HTMLDivElement>(null);
  const hasPrebuiltDashboards = organization.features.includes(
    'dashboards-prebuilt-insights-dashboards'
  );
  const urlFilter = decodeScalar(location.query.filter) as DashboardFilter | undefined;
  const isOnlyPrebuilt =
    hasPrebuiltDashboards && urlFilter === DashboardFilter.ONLY_PREBUILT;

  const areAiFeaturesAllowed =
    !organization.hideAiFeatures && organization.features.includes('gen-ai-features');

  const [dashboardsLayout, setDashboardsLayout] = useLocalStorageState(
    LAYOUT_KEY,
    getDashboardsOverviewLayout()
  );
  const [{rowCount, columnCount}, setGridSize] = useState({
    rowCount: DASHBOARD_GRID_DEFAULT_NUM_ROWS,
    columnCount: DASHBOARD_GRID_DEFAULT_NUM_COLUMNS,
  });

  const {hasProjectAccess, projectsLoaded} = useHasProjectAccess();

  const sortOptions = getSortOptions({
    organization,
    dashboardsLayout,
    isOnlyPrebuilt,
  });

  const {
    data: dashboardsResponse,
    isLoading,
    isError,
    error,
    refetch: refetchDashboards,
  } = useQuery({
    ...dashboardsApiOptions(organization, {
      query: {
        ...pick(location.query, ['cursor', 'query']),
        sort: getActiveSort()?.value,
        pin: 'favorites',
        per_page:
          dashboardsLayout === GRID ? rowCount * columnCount : DASHBOARD_TABLE_NUM_ROWS,
        ...(isOnlyPrebuilt
          ? {filter: DashboardFilter.ONLY_PREBUILT}
          : {filter: DashboardFilter.EXCLUDE_PREBUILT}),
      },
    }),
    select: selectJsonWithHeaders,
    enabled:
      (hasProjectAccess || !projectsLoaded) &&
      !(
        organization.features.includes('dashboards-starred-reordering') &&
        dashboardsLayout === TABLE
      ),
  });
  const dashboardsWithoutPrebuiltConfigs = dashboardsResponse?.json;

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
      (hasProjectAccess || !projectsLoaded) &&
      organization.features.includes('dashboards-starred-reordering') &&
      dashboardsLayout === TABLE,
  });

  const dashboardsPageLinks = dashboardsResponse?.headers.Link ?? '';

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
          const start = performance.now();
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

          scheduleMicroTask(() => {
            const duration = performance.now() - start;
            Sentry.metrics.distribution('dashboards.widget.onResize', duration, {
              unit: 'millisecond',
              attributes: {page: 'manage'},
            });
          });
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
      isOnlyPrebuilt,
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
    isOnlyPrebuilt,
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
      isOnlyPrebuilt,
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

  function getQuery() {
    const {query} = location.query;

    return typeof query === 'string' ? query : undefined;
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
          trigger={triggerProps => (
            <OverlayTrigger.Button {...triggerProps} prefix={t('Sort By')} />
          )}
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
      <Stack flex={1}>
        <Alert.Container>
          <Alert variant="warning" showIcon={false}>
            {t("You don't have access to this feature")}
          </Alert>
        </Alert.Container>
      </Stack>
    );
  }

  function renderDashboards() {
    return dashboardsLayout === GRID ? (
      <DashboardGrid
        api={api}
        dashboards={dashboards}
        organization={organization}
        onDashboardsChange={() => refetchDashboards()}
        isLoading={isLoading}
        rowCount={rowCount}
        columnCount={columnCount}
      />
    ) : organization.features.includes('dashboards-starred-reordering') ? (
      <OwnedDashboardsTable
        dashboards={ownedDashboards.data?.json ?? []}
        isLoading={ownedDashboards.isLoading}
        pageLinks={ownedDashboards.data?.headers.Link}
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

    navigate(normalizeUrl(`/organizations/${organization.slug}/dashboards/new/`));
  }

  function onGenerateDashboard() {
    trackAnalytics('dashboards_manage.generate.start', {
      organization,
    });
    navigate(
      normalizeUrl({
        pathname: `/organizations/${organization.slug}/dashboards/new/from-seer/`,
      })
    );
  }

  return (
    <Feature
      organization={organization}
      features="dashboards-edit"
      renderDisabled={renderNoAccess}
    >
      <SentryDocumentTitle
        title={isOnlyPrebuilt ? PREBUILT_DASHBOARD_LABEL : t('All Dashboards')}
        orgSlug={organization.slug}
      >
        <ErrorBoundary>
          {isError ? (
            <Stack flex={1} padding="2xl 3xl">
              <RouteError error={error} />
            </Stack>
          ) : (
            <Stack flex={1}>
              <NoProjectMessage organization={organization}>
                <Layout.Header unified>
                  <Layout.HeaderContent unified>
                    <Layout.Title>
                      {isOnlyPrebuilt ? PREBUILT_DASHBOARD_LABEL : t('All Dashboards')}
                      <PageHeadingQuestionTooltip
                        docsUrl="https://docs.sentry.io/product/dashboards/"
                        title={
                          isOnlyPrebuilt
                            ? t(
                                'Dashboards built by Sentry to help monitor your application out of the box.'
                              )
                            : t(
                                "A broad overview of your application's health where you can navigate through error and performance data across multiple projects."
                              )
                        }
                      />
                    </Layout.Title>
                  </Layout.HeaderContent>
                  {hasPageFrameFeature ? (
                    <Fragment>
                      <TopBar.Slot name="actions">
                        <Feature features={['dashboards-ai-generate']}>
                          {({hasFeature: hasAiGenerate}) =>
                            hasAiGenerate && areAiFeaturesAllowed ? (
                              <DashboardCreateLimitWrapper>
                                {({
                                  hasReachedDashboardLimit,
                                  isLoading: isLoadingDashboardsLimit,
                                  limitMessage,
                                }) => (
                                  <DropdownMenu
                                    items={[
                                      {
                                        key: 'create-dashboard',
                                        label: t('Create dashboard manually'),
                                        onAction: () => onCreate(),
                                        disabled:
                                          hasReachedDashboardLimit ||
                                          isLoadingDashboardsLimit,
                                        details: limitMessage,
                                      },
                                      {
                                        key: 'create-dashboard-agent',
                                        textValue: t('Generate dashboard'),
                                        label: (
                                          <Flex gap="sm" align="center" as="span">
                                            {t('Generate dashboard')}
                                            <FeatureBadge type="beta" />
                                          </Flex>
                                        ),
                                        onAction: () => onGenerateDashboard(),
                                        disabled:
                                          hasReachedDashboardLimit ||
                                          isLoadingDashboardsLimit,
                                        details: limitMessage,
                                      },
                                    ]}
                                    trigger={triggerProps => (
                                      <Button
                                        {...triggerProps}
                                        data-test-id="dashboard-create"
                                        priority="primary"
                                        icon={<IconAdd />}
                                      >
                                        {t('Create Dashboard')}
                                      </Button>
                                    )}
                                  />
                                )}
                              </DashboardCreateLimitWrapper>
                            ) : (
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
                                    priority="primary"
                                    icon={<IconAdd />}
                                    disabled={
                                      hasReachedDashboardLimit || isLoadingDashboardsLimit
                                    }
                                    tooltipProps={{
                                      isHoverable: true,
                                      title: limitMessage,
                                    }}
                                  >
                                    {t('Create Dashboard')}
                                  </Button>
                                )}
                              </DashboardCreateLimitWrapper>
                            )
                          }
                        </Feature>
                        <Feature features="dashboards-import">
                          <Button
                            onClick={() => {
                              openImportDashboardFromFileModal({
                                organization,
                                api,
                                location,
                              });
                            }}
                            priority="primary"
                            icon={<IconAdd />}
                          >
                            {t('Import Dashboard from JSON')}
                          </Button>
                        </Feature>
                      </TopBar.Slot>
                      <TopBar.Slot name="feedback">
                        <FeedbackButton
                          aria-label={t('Give Feedback')}
                          tooltipProps={{title: t('Give Feedback')}}
                        >
                          {null}
                        </FeedbackButton>
                      </TopBar.Slot>
                    </Fragment>
                  ) : (
                    <Layout.HeaderActions>
                      <Grid flow="column" align="center" gap="lg">
                        <FeedbackButton />
                        <Feature features={['dashboards-ai-generate']}>
                          {({hasFeature: hasAiGenerate}) =>
                            hasAiGenerate && areAiFeaturesAllowed ? (
                              <DashboardCreateLimitWrapper>
                                {({
                                  hasReachedDashboardLimit,
                                  isLoading: isLoadingDashboardsLimit,
                                  limitMessage,
                                }) => (
                                  <DropdownMenu
                                    items={[
                                      {
                                        key: 'create-dashboard',
                                        label: t('Create dashboard manually'),
                                        onAction: () => onCreate(),
                                        disabled:
                                          hasReachedDashboardLimit ||
                                          isLoadingDashboardsLimit,
                                        details: limitMessage,
                                      },
                                      {
                                        key: 'create-dashboard-agent',
                                        textValue: t('Generate dashboard'),
                                        label: (
                                          <Flex gap="sm" align="center" as="span">
                                            {t('Generate dashboard')}
                                            <FeatureBadge type="beta" />
                                          </Flex>
                                        ),
                                        onAction: () => onGenerateDashboard(),
                                        disabled:
                                          hasReachedDashboardLimit ||
                                          isLoadingDashboardsLimit,
                                        details: limitMessage,
                                      },
                                    ]}
                                    trigger={triggerProps => (
                                      <Button
                                        {...triggerProps}
                                        data-test-id="dashboard-create"
                                        size="sm"
                                        priority="primary"
                                        icon={<IconAdd />}
                                      >
                                        {t('Create Dashboard')}
                                      </Button>
                                    )}
                                  />
                                )}
                              </DashboardCreateLimitWrapper>
                            ) : (
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
                                    tooltipProps={{
                                      isHoverable: true,
                                      title: limitMessage,
                                    }}
                                  >
                                    {t('Create Dashboard')}
                                  </Button>
                                )}
                              </DashboardCreateLimitWrapper>
                            )
                          }
                        </Feature>
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
                      </Grid>
                    </Layout.HeaderActions>
                  )}
                </Layout.Header>
                <Layout.Body>
                  <Layout.Main width="full">
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
            </Stack>
          )}
        </ErrorBoundary>
      </SentryDocumentTitle>
    </Feature>
  );
}

const StyledActions = styled('div')`
  display: grid;
  grid-template-columns: auto max-content max-content;
  gap: ${p => p.theme.space.xl};
  margin-bottom: ${p => p.theme.space.xl};

  @media (max-width: ${p => p.theme.breakpoints.sm}) {
    grid-template-columns: auto;
  }
`;

const PaginationRow = styled(Pagination)`
  margin-bottom: ${p => p.theme.space['2xl']};
`;

export default ManageDashboards;
