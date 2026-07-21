import {useEffect, useMemo} from 'react';
import styled from '@emotion/styled';
import {useQuery, useQueryClient} from '@tanstack/react-query';
import type {Query} from 'history';
import pick from 'lodash/pick';

import {Alert} from '@sentry/scraps/alert';
import {FeatureBadge} from '@sentry/scraps/badge';
import {Button} from '@sentry/scraps/button';
import {CompactSelect} from '@sentry/scraps/compactSelect';
import {Flex, Stack} from '@sentry/scraps/layout';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';
import {Pagination} from '@sentry/scraps/pagination';

import {openImportDashboardFromFileModal} from 'sentry/actionCreators/modal';
import Feature from 'sentry/components/acl/feature';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import {ErrorBoundary} from 'sentry/components/errorBoundary';
import {FeedbackButton} from 'sentry/components/feedbackButton/feedbackButton';
import * as Layout from 'sentry/components/layouts/thirds';
import {NoProjectMessage} from 'sentry/components/noProjectMessage';
import {PageHeadingQuestionTooltip} from 'sentry/components/pageHeadingQuestionTooltip';
import {SearchBar} from 'sentry/components/searchBar';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {IconAdd} from 'sentry/icons';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {selectJsonWithHeaders} from 'sentry/utils/api/apiOptions';
import {dashboardsApiOptions} from 'sentry/utils/dashboards/dashboardsApiOptions';
import {decodeScalar} from 'sentry/utils/queryString';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useApi} from 'sentry/utils/useApi';
import {useHasProjectAccess} from 'sentry/utils/useHasProjectAccess';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {DashboardCreateLimitWrapper} from 'sentry/views/dashboards/createLimitWrapper';
import DashboardTable from 'sentry/views/dashboards/manage/dashboardTable';
import {getIsOnlyPrebuilt} from 'sentry/views/dashboards/manage/utils/getIsOnlyPrebuilt';
import {DashboardFilter, PREBUILT_DASHBOARD_LABEL} from 'sentry/views/dashboards/types';
import {PREBUILT_DASHBOARDS} from 'sentry/views/dashboards/utils/prebuiltConfigs';
import {TopBar} from 'sentry/views/navigation/topBar';
import {RouteError} from 'sentry/views/routeError';

import {DASHBOARD_TABLE_NUM_ROWS, DEFAULT_PREBUILT_SORT} from './settings';

function getSortOptions({isOnlyPrebuilt}: {isOnlyPrebuilt: boolean}) {
  const options = [];

  if (!isOnlyPrebuilt) {
    options.push({label: t('My Dashboards'), value: 'mydashboards'});
  }

  options.push(
    {label: t('Dashboard Name (A-Z)'), value: 'title'},
    {label: t('Dashboard Name (Z-A)'), value: '-title'},
    {label: t('Date Created (Newest)'), value: '-dateCreated'},
    {label: t('Date Created (Oldest)'), value: 'dateCreated'},
    {label: t('Most Popular'), value: 'mostPopular'},
    {label: t('Recently Viewed'), value: 'recentlyViewed'}
  );

  return options;
}

function getDefaultSort({isOnlyPrebuilt}: {isOnlyPrebuilt: boolean}) {
  if (isOnlyPrebuilt) {
    return DEFAULT_PREBUILT_SORT;
  }

  return 'mydashboards';
}

function ManageDashboards() {
  const organization = useOrganization();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const api = useApi();
  const hasPrebuiltDashboards = organization.features.includes(
    'dashboards-prebuilt-insights-dashboards'
  );
  const urlFilter = decodeScalar(location.query.filter) as DashboardFilter | undefined;
  const isOnlyPrebuilt = getIsOnlyPrebuilt(hasPrebuiltDashboards, urlFilter);
  const pageTitle = isOnlyPrebuilt ? PREBUILT_DASHBOARD_LABEL : t('All Dashboards');

  const areAiFeaturesAllowed =
    !organization.hideAiFeatures && organization.features.includes('gen-ai-features');

  const {hasProjectAccess, projectsLoaded} = useHasProjectAccess();

  const sortOptions = getSortOptions({isOnlyPrebuilt});

  const {
    data: dashboardsResponse,
    isLoading,
    isError,
    error,
  } = useQuery({
    ...dashboardsApiOptions(organization, {
      query: {
        ...pick(location.query, ['cursor', 'query']),
        sort: getActiveSort()?.value,
        pin: 'favorites',
        per_page: DASHBOARD_TABLE_NUM_ROWS,
        ...(isOnlyPrebuilt ? {filter: DashboardFilter.ONLY_PREBUILT} : {}),
      },
    }),
    select: selectJsonWithHeaders,
    enabled: hasProjectAccess || !projectsLoaded,
  });
  const dashboardsWithoutPrebuiltConfigs = dashboardsResponse?.json;

  function invalidateDashboards() {
    queryClient.invalidateQueries(dashboardsApiOptions(organization));
  }

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

  const dashboardsPageLinks = dashboardsResponse?.headers.Link ?? '';

  useEffect(() => {
    const urlSort = decodeScalar(location.query.sort);
    const defaultSort = getDefaultSort({isOnlyPrebuilt});
    if (urlSort && !sortOptions.some(option => option.value === urlSort)) {
      // The sort option is not valid, so we need to set the default sort
      // in the URL
      navigate({
        pathname: location.pathname,
        query: {...location.query, sort: defaultSort},
      });
    }
  }, [
    isOnlyPrebuilt,
    location.pathname,
    location.query,
    navigate,
    organization,
    sortOptions,
  ]);

  function getActiveSort() {
    const defaultSort = getDefaultSort({isOnlyPrebuilt});
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
                        disabled: hasReachedDashboardLimit || isLoadingDashboardsLimit,
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
                        disabled: hasReachedDashboardLimit || isLoadingDashboardsLimit,
                        details: limitMessage,
                      },
                    ]}
                    trigger={triggerProps => (
                      <Button
                        {...triggerProps}
                        data-test-id="dashboard-create"
                        variant="primary"
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
                    variant="primary"
                    icon={<IconAdd />}
                    disabled={hasReachedDashboardLimit || isLoadingDashboardsLimit}
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
    return (
      <DashboardTable
        api={api}
        dashboards={dashboards}
        organization={organization}
        location={location}
        onDashboardsChange={invalidateDashboards}
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
      <SentryDocumentTitle title={pageTitle} orgSlug={organization.slug}>
        <ErrorBoundary>
          {isError ? (
            <Stack flex={1} padding="2xl 3xl">
              <RouteError error={error} />
            </Stack>
          ) : (
            <Stack flex={1}>
              <NoProjectMessage organization={organization}>
                <Layout.Title>
                  {pageTitle}
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
                <TopBar.Slot name="actions">
                  <Feature features="dashboards-import">
                    <Button
                      onClick={() => {
                        openImportDashboardFromFileModal({
                          organization,
                          api,
                          location,
                        });
                      }}
                      variant="primary"
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
                <Layout.Body>
                  <Layout.Main width="full">
                    {renderActions()}
                    <div id="dashboard-list-container">{renderDashboards()}</div>
                    {renderPagination()}
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
  gap: ${p => p.theme.space.md};
  margin-bottom: ${p => p.theme.space.xl};

  @media (max-width: ${p => p.theme.breakpoints.sm}) {
    grid-template-columns: auto;
  }
`;

const PaginationRow = styled(Pagination)`
  margin-bottom: ${p => p.theme.space['2xl']};
`;

export default ManageDashboards;
