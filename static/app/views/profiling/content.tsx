import {Fragment, useCallback, useEffect, useMemo} from 'react';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';
import {Location} from 'history';

import {Alert} from 'sentry/components/alert';
import {Button} from 'sentry/components/button';
import SearchBar from 'sentry/components/events/searchBar';
import FeedbackWidgetButton from 'sentry/components/feedback/widget/feedbackWidgetButton';
import * as Layout from 'sentry/components/layouts/thirds';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import {ProjectPageFilter} from 'sentry/components/organizations/projectPageFilter';
import {PageHeadingQuestionTooltip} from 'sentry/components/pageHeadingQuestionTooltip';
import Pagination from 'sentry/components/pagination';
import {
  ProfilingAM1OrMMXUpgrade,
  ProfilingBetaAlertBanner,
  ProfilingUpgradeButton,
} from 'sentry/components/profiling/billing/alerts';
import {ProfileEventsTable} from 'sentry/components/profiling/profileEventsTable';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {SidebarPanelKey} from 'sentry/components/sidebar/types';
import SmartSearchBar, {SmartSearchBarProps} from 'sentry/components/smartSearchBar';
import {MAX_QUERY_LENGTH} from 'sentry/constants';
import {ALL_ACCESS_PROJECTS} from 'sentry/constants/pageFilters';
import {t} from 'sentry/locale';
import SidebarPanelStore from 'sentry/stores/sidebarPanelStore';
import {space} from 'sentry/styles/space';
import {trackAnalytics} from 'sentry/utils/analytics';
import EventView from 'sentry/utils/discover/eventView';
import {useProfileEvents} from 'sentry/utils/profiling/hooks/useProfileEvents';
import {useProfileFilters} from 'sentry/utils/profiling/hooks/useProfileFilters';
import {formatError, formatSort} from 'sentry/utils/profiling/hooks/utils';
import {decodeScalar} from 'sentry/utils/queryString';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';
import {DEFAULT_PROFILING_DATETIME_SELECTION} from 'sentry/views/profiling/utils';

import {LandingWidgetSelector} from './landing/landingWidgetSelector';
import {ProfilesChart} from './landing/profileCharts';
import {ProfilesChartWidget} from './landing/profilesChartWidget';
import {ProfilingSlowestTransactionsPanel} from './landing/profilingSlowestTransactionsPanel';
import {ProfilingOnboardingPanel} from './profilingOnboardingPanel';

const LEFT_WIDGET_CURSOR = 'leftCursor';
const RIGHT_WIDGET_CURSOR = 'rightCursor';
const CURSOR_PARAMS = [LEFT_WIDGET_CURSOR, RIGHT_WIDGET_CURSOR];

interface ProfilingContentProps {
  location: Location;
}

function ProfilingContent({location}: ProfilingContentProps) {
  const organization = useOrganization();
  const {selection} = usePageFilters();
  const cursor = decodeScalar(location.query.cursor);
  const query = decodeScalar(location.query.query, '');

  const profilingUsingTransactions = organization.features.includes(
    'profiling-using-transactions'
  );

  const fields = profilingUsingTransactions ? ALL_FIELDS : BASE_FIELDS;

  const sort = formatSort<FieldType>(decodeScalar(location.query.sort), fields, {
    key: 'count()',
    order: 'desc',
  });

  const profileFilters = useProfileFilters({
    query: '',
    selection,
    disabled: profilingUsingTransactions,
  });
  const {projects} = useProjects();

  const transactions = useProfileEvents<FieldType>({
    cursor,
    fields,
    query,
    sort,
    referrer: 'api.profiling.landing-table',
  });

  const transactionsError =
    transactions.status === 'error' ? formatError(transactions.error) : null;

  useEffect(() => {
    trackAnalytics('profiling_views.landing', {
      organization,
    });
  }, [organization]);

  const handleSearch: SmartSearchBarProps['onSearch'] = useCallback(
    (searchQuery: string) => {
      browserHistory.push({
        ...location,
        query: {
          ...location.query,
          cursor: undefined,
          query: searchQuery || undefined,
        },
      });
    },
    [location]
  );

  // Open the modal on demand
  const onSetupProfilingClick = useCallback(() => {
    trackAnalytics('profiling_views.onboarding', {
      organization,
    });
    SidebarPanelStore.activatePanel(SidebarPanelKey.PROFILING_ONBOARDING);
  }, [organization]);

  const shouldShowProfilingOnboardingPanel = useMemo((): boolean => {
    // if it's My Projects or All projects, only show onboarding if we can't
    // find any projects with profiles
    if (
      selection.projects.length === 0 ||
      selection.projects[0] === ALL_ACCESS_PROJECTS
    ) {
      return projects.every(project => !project.hasProfiles);
    }

    // otherwise, only show onboarding if we can't find any projects with profiles
    // from those that were selected
    const projectsWithProfiles = new Set(
      projects.filter(project => project.hasProfiles).map(project => project.id)
    );
    return selection.projects.every(
      project => !projectsWithProfiles.has(String(project))
    );
  }, [selection.projects, projects]);

  const eventView = useMemo(() => {
    const _eventView = EventView.fromNewQueryWithLocation(
      {
        id: undefined,
        version: 2,
        name: t('Profiling'),
        fields: [],
        query,
        projects: selection.projects,
      },
      location
    );
    _eventView.additionalConditions.setFilterValues('has', ['profile.id']);
    return _eventView;
  }, [location, query, selection.projects]);

  return (
    <SentryDocumentTitle title={t('Profiling')} orgSlug={organization.slug}>
      <PageFiltersContainer
        defaultSelection={
          profilingUsingTransactions
            ? {datetime: DEFAULT_PROFILING_DATETIME_SELECTION}
            : undefined
        }
      >
        <Layout.Page>
          <ProfilingBetaAlertBanner organization={organization} />
          <Layout.Header>
            <StyledHeaderContent>
              <Layout.Title>
                {t('Profiling')}
                <PageHeadingQuestionTooltip
                  docsUrl="https://docs.sentry.io/product/profiling/"
                  title={t(
                    'Profiling collects detailed information in production about the functions executing in your application and how long they take to run, giving you code-level visibility into your hot paths.'
                  )}
                />
              </Layout.Title>
              <FeedbackWidgetButton />
            </StyledHeaderContent>
          </Layout.Header>
          <Layout.Body>
            <Layout.Main fullWidth>
              {transactionsError && (
                <Alert type="error" showIcon>
                  {transactionsError}
                </Alert>
              )}
              <ActionBar>
                <PageFilterBar condensed>
                  <ProjectPageFilter resetParamsOnChange={CURSOR_PARAMS} />
                  <EnvironmentPageFilter resetParamsOnChange={CURSOR_PARAMS} />
                  <DatePageFilter resetParamsOnChange={CURSOR_PARAMS} />
                </PageFilterBar>
                {profilingUsingTransactions ? (
                  <SearchBar
                    searchSource="profile_summary"
                    organization={organization}
                    projectIds={eventView.project}
                    query={query}
                    onSearch={handleSearch}
                    maxQueryLength={MAX_QUERY_LENGTH}
                  />
                ) : (
                  <SmartSearchBar
                    organization={organization}
                    hasRecentSearches
                    searchSource="profile_landing"
                    supportedTags={profileFilters}
                    query={query}
                    onSearch={handleSearch}
                    maxQueryLength={MAX_QUERY_LENGTH}
                  />
                )}
              </ActionBar>
              {shouldShowProfilingOnboardingPanel ? (
                // If user is on m2, show default
                <ProfilingOnboardingPanel
                  content={
                    <ProfilingAM1OrMMXUpgrade
                      organization={organization}
                      fallback={
                        <Fragment>
                          <h3>{t('Function level insights')}</h3>
                          <p>
                            {t(
                              'Discover slow-to-execute or resource intensive functions within your application'
                            )}
                          </p>
                        </Fragment>
                      }
                    />
                  }
                >
                  <ProfilingUpgradeButton
                    organization={organization}
                    priority="primary"
                    onClick={onSetupProfilingClick}
                    fallback={
                      <Button onClick={onSetupProfilingClick} priority="primary">
                        {t('Set Up Profiling')}
                      </Button>
                    }
                  >
                    {t('Set Up Profiling')}
                  </ProfilingUpgradeButton>
                  <Button href="https://docs.sentry.io/product/profiling/" external>
                    {t('Read Docs')}
                  </Button>
                </ProfilingOnboardingPanel>
              ) : (
                <Fragment>
                  {organization.features.includes(
                    'profiling-global-suspect-functions'
                  ) ? (
                    <Fragment>
                      <ProfilesChartWidget
                        chartHeight={150}
                        referrer="api.profiling.landing-chart"
                        userQuery={query}
                        selection={selection}
                      />
                      <WidgetsContainer>
                        <LandingWidgetSelector
                          cursorName={LEFT_WIDGET_CURSOR}
                          widgetHeight="340px"
                          defaultWidget="slowest functions"
                          query={query}
                          storageKey="profiling-landing-widget-0"
                        />
                        <LandingWidgetSelector
                          cursorName={RIGHT_WIDGET_CURSOR}
                          widgetHeight="340px"
                          defaultWidget="regressed functions"
                          query={query}
                          storageKey="profiling-landing-widget-1"
                        />
                      </WidgetsContainer>
                    </Fragment>
                  ) : (
                    <PanelsGrid>
                      <ProfilingSlowestTransactionsPanel />
                      <ProfilesChart
                        referrer="api.profiling.landing-chart"
                        query={query}
                        selection={selection}
                        hideCount
                      />
                    </PanelsGrid>
                  )}
                  <ProfileEventsTable
                    columns={fields.slice()}
                    data={transactions.status === 'success' ? transactions.data : null}
                    error={
                      transactions.status === 'error'
                        ? t('Unable to load profiles')
                        : null
                    }
                    isLoading={transactions.status === 'loading'}
                    sort={sort}
                    sortableColumns={new Set(fields)}
                  />
                  <Pagination
                    pageLinks={
                      transactions.status === 'success'
                        ? transactions.getResponseHeader?.('Link') ?? null
                        : null
                    }
                  />
                </Fragment>
              )}
            </Layout.Main>
          </Layout.Body>
        </Layout.Page>
      </PageFiltersContainer>
    </SentryDocumentTitle>
  );
}

const BASE_FIELDS = [
  'transaction',
  'project.id',
  'last_seen()',
  'p75()',
  'p95()',
  'p99()',
  'count()',
] as const;

// user misery is only available with the profiling-using-transactions feature
const ALL_FIELDS = [...BASE_FIELDS, 'user_misery()'] as const;

type FieldType = (typeof ALL_FIELDS)[number];

const StyledHeaderContent = styled(Layout.HeaderContent)`
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-direction: row;
`;

const ActionBar = styled('div')`
  display: grid;
  gap: ${space(2)};
  grid-template-columns: min-content auto;
  margin-bottom: ${space(2)};
`;

// TODO: another simple primitive that can easily be <Grid columns={2} />
const PanelsGrid = styled('div')`
  display: grid;
  grid-template-columns: minmax(0, 1fr) 1fr;
  gap: ${space(2)};
  @media (max-width: ${p => p.theme.breakpoints.small}) {
    grid-template-columns: minmax(0, 1fr);
  }
`;

const WidgetsContainer = styled('div')`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: ${space(2)};
  @media (max-width: ${p => p.theme.breakpoints.small}) {
    grid-template-columns: 1fr;
  }
`;

export default ProfilingContent;
