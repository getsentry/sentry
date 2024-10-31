import {useEffect, useState} from 'react';
import styled from '@emotion/styled';
import debounce from 'lodash/debounce';
import pick from 'lodash/pick';

import {createDashboard} from 'sentry/actionCreators/dashboards';
import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import {openImportDashboardFromFileModal} from 'sentry/actionCreators/modal';
import Feature from 'sentry/components/acl/feature';
import {Alert} from 'sentry/components/alert';
import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import {CompactSelect} from 'sentry/components/compactSelect';
import ErrorBoundary from 'sentry/components/errorBoundary';
import FeedbackWidgetButton from 'sentry/components/feedback/widget/feedbackWidgetButton';
import * as Layout from 'sentry/components/layouts/thirds';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import NoProjectMessage from 'sentry/components/noProjectMessage';
import {PageHeadingQuestionTooltip} from 'sentry/components/pageHeadingQuestionTooltip';
import SearchBar from 'sentry/components/searchBar';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import Switch from 'sentry/components/switchButton';
import {IconAdd} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {SelectValue} from 'sentry/types/core';
import {trackAnalytics} from 'sentry/utils/analytics';
import parseLinkHeader from 'sentry/utils/parseLinkHeader';
import {useApiQuery} from 'sentry/utils/queryClient';
import {decodeScalar} from 'sentry/utils/queryString';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import useApi from 'sentry/utils/useApi';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {DashboardImportButton} from 'sentry/views/dashboards/manage/dashboardImport';
import {MetricsRemovedAlertsWidgetsAlert} from 'sentry/views/metrics/metricsRemovedAlertsWidgetsAlert';
import RouteError from 'sentry/views/routeError';

import {getDashboardTemplates} from '../data';
import {assignDefaultLayout, getInitialColumnDepths} from '../layoutUtils';
import type {DashboardDetails, DashboardListItem} from '../types';

import DashboardList from './dashboardList';
import TemplateCard from './templateCard';
import {shouldShowTemplates, SHOW_TEMPLATES_KEY} from './utils';

const SORT_OPTIONS: SelectValue<string>[] = [
  {label: t('My Dashboards'), value: 'mydashboards'},
  {label: t('Dashboard Name (A-Z)'), value: 'title'},
  {label: t('Date Created (Newest)'), value: '-dateCreated'},
  {label: t('Date Created (Oldest)'), value: 'dateCreated'},
  {label: t('Most Popular'), value: 'mostPopular'},
  {label: t('Recently Viewed'), value: 'recentlyViewed'},
];

function ManageDashboards() {
  const organization = useOrganization();
  const navigate = useNavigate();
  const location = useLocation();
  const api = useApi();

  const [resizing, setResizing] = useState(false);
  const [windowWidth, setWindowWidth] = useState(0);

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
          sort: getActiveSort().value,
          per_page: getDashboardsPerPage(),
        },
      },
    ],
    {staleTime: 0}
  );

  const dashboardsPageLinks = getResponseHeader?.('Link') ?? '';

  const [showTemplates, setShowTemplatesLocal] = useLocalStorageState(
    SHOW_TEMPLATES_KEY,
    shouldShowTemplates()
  );

  const debouncedHandleResize = debounce(() => {
    const currentWidth = window.innerWidth;
    // Only update state if the width has changed
    if (currentWidth !== windowWidth) {
      setWindowWidth(currentWidth);
      setResizing(true);
    } else {
      setResizing(false);
    }
    const paginationObject = parseLinkHeader(dashboardsPageLinks);
    if (
      dashboards?.length &&
      paginationObject.next.results &&
      getDashboardsPerPage() > dashboards.length
    ) {
      refetchDashboards();
    }
  }, 250);

  useEffect(() => {
    window.addEventListener('resize', debouncedHandleResize);

    return () => {
      window.removeEventListener('resize', debouncedHandleResize);
    };
  }, [debouncedHandleResize]);

  function getDashboardsPerPage(): number {
    // min-midth of widget is 300px with additional 16px margin on each side (also accounting for side menu)
    return Math.floor((window.innerWidth - 100) / (300 + 32)) < 3
      ? 8
      : Math.floor((window.innerWidth - 100) / (300 + 32)) * 3;
  }

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
      <StyledActions>
        <SearchBar
          defaultQuery=""
          query={getQuery()}
          placeholder={t('Search Dashboards')}
          onSearch={query => handleSearch(query)}
        />
        <CompactSelect
          triggerProps={{prefix: t('Sort By')}}
          value={activeSort.value}
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
        <Alert type="warning">{t("You don't have access to this feature")}</Alert>
      </Layout.Page>
    );
  }

  function renderDashboards() {
    return (
      <DashboardList
        api={api}
        dashboards={dashboards}
        organization={organization}
        pageLinks={dashboardsPageLinks}
        location={location}
        onDashboardsChange={() => refetchDashboards()}
        loading={isLoading}
        resizing={resizing}
        limit={getDashboardsPerPage()}
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

  function ManageDashboardsContent() {
    if (isLoading) {
      return (
        <Layout.Page withPadding>
          <LoadingIndicator />
        </Layout.Page>
      );
    }

    if (isError) {
      return (
        <Layout.Page withPadding>
          <RouteError error={error} />
        </Layout.Page>
      );
    }

    return (
      <ErrorBoundary>
        <Layout.Page>
          <NoProjectMessage organization={organization}>
            <Layout.Header>
              <Layout.HeaderContent>
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
                    <Switch isActive={showTemplates} size="lg" toggle={toggleTemplates} />
                  </TemplateSwitch>
                  <FeedbackWidgetButton />
                  <DashboardImportButton />
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
                <MetricsRemovedAlertsWidgetsAlert organization={organization} />

                {showTemplates && renderTemplates()}
                {renderActions()}
                {renderDashboards()}
              </Layout.Main>
            </Layout.Body>
          </NoProjectMessage>
        </Layout.Page>
      </ErrorBoundary>
    );
  }

  return (
    <Feature
      organization={organization}
      features="dashboards-edit"
      renderDisabled={renderNoAccess}
    >
      <SentryDocumentTitle title={t('Dashboards')} orgSlug={organization.slug}>
        <ManageDashboardsContent />
      </SentryDocumentTitle>
    </Feature>
  );
}

const StyledActions = styled('div')`
  display: grid;
  grid-template-columns: auto max-content;
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

export default ManageDashboards;
