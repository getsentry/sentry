import {Fragment, useCallback, useEffect, useMemo} from 'react';
import styled from '@emotion/styled';
import type {Location} from 'history';

import {Alert} from 'sentry/components/alert';
import {Button, LinkButton} from 'sentry/components/button';
import FeedbackWidgetButton from 'sentry/components/feedback/widget/feedbackWidgetButton';
import * as Layout from 'sentry/components/layouts/thirds';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import {ProjectPageFilter} from 'sentry/components/organizations/projectPageFilter';
import {PageHeadingQuestionTooltip} from 'sentry/components/pageHeadingQuestionTooltip';
import Pagination from 'sentry/components/pagination';
import {TransactionSearchQueryBuilder} from 'sentry/components/performance/transactionSearchQueryBuilder';
import {
  ProfilingAM1OrMMXUpgrade,
  ProfilingBetaAlertBanner,
  ProfilingUpgradeButton,
} from 'sentry/components/profiling/billing/alerts';
import {ProfileEventsTable} from 'sentry/components/profiling/profileEventsTable';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {SidebarPanelKey} from 'sentry/components/sidebar/types';
import type {SmartSearchBarProps} from 'sentry/components/smartSearchBar';
import {TabList, Tabs} from 'sentry/components/tabs';
import {ALL_ACCESS_PROJECTS} from 'sentry/constants/pageFilters';
import {t} from 'sentry/locale';
import SidebarPanelStore from 'sentry/stores/sidebarPanelStore';
import {space} from 'sentry/styles/space';
import {trackAnalytics} from 'sentry/utils/analytics';
import {browserHistory} from 'sentry/utils/browserHistory';
import {useProfileEvents} from 'sentry/utils/profiling/hooks/useProfileEvents';
import {formatError, formatSort} from 'sentry/utils/profiling/hooks/utils';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';
import {
  TableHeader,
  TableHeaderActions,
  TableHeaderTitle,
} from 'sentry/views/explore/components/table';
import {LandingAggregateFlamegraph} from 'sentry/views/profiling/landingAggregateFlamegraph';
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

function validateTab(tab: unknown): tab is 'flamegraph' | 'transactions' {
  return tab === 'flamegraph' || tab === 'transactions';
}

function decodeTab(tab: unknown): 'flamegraph' | 'transactions' {
  // Fallback to transactions if tab is invalid. We default to transactions
  // because that is going to be the most common perf setup when we release.
  return validateTab(tab) ? tab : 'transactions';
}

export default function ProfilingContent({location}: ProfilingContentProps) {
  const organization = useOrganization();
  const {selection} = usePageFilters();
  const {projects} = useProjects();

  const tab = decodeTab(location.query.tab);

  useEffect(() => {
    trackAnalytics('profiling_views.landing', {
      organization,
    });
  }, [organization]);

  const onTabChange = useCallback(
    (newTab: 'flamegraph' | 'transactions') => {
      browserHistory.push({
        ...location,
        query: {
          ...location.query,
          tab: newTab,
        },
      });
    },
    [location]
  );

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

  return (
    <SentryDocumentTitle title={t('Profiling')} orgSlug={organization.slug}>
      <PageFiltersContainer
        defaultSelection={{datetime: DEFAULT_PROFILING_DATETIME_SELECTION}}
      >
        <Layout.Page>
          <ProfilingBetaAlertBanner organization={organization} />
          <ProfilingContentPageHeader tab={tab} onTabChange={onTabChange} />
          {tab === 'flamegraph' ? (
            <FlamegraphBody>
              <ProfilingFlamegraphTabContent
                tab={tab}
                shouldShowProfilingOnboardingPanel={shouldShowProfilingOnboardingPanel}
              />
            </FlamegraphBody>
          ) : tab === 'transactions' ? (
            <Layout.Body>
              <ProfilingTransactionsContent
                tab={tab}
                shouldShowProfilingOnboardingPanel={shouldShowProfilingOnboardingPanel}
              />
            </Layout.Body>
          ) : null}
        </Layout.Page>
      </PageFiltersContainer>
    </SentryDocumentTitle>
  );
}

interface ProfilingTabContentProps {
  shouldShowProfilingOnboardingPanel: boolean;
  tab: 'flamegraph' | 'transactions';
}

function ProfilingFlamegraphTabContent(props: ProfilingTabContentProps) {
  return (
    <FlamegraphMainLayout>
      <FlamegraphActionBar>
        <PageFilterBar condensed>
          <ProjectPageFilter resetParamsOnChange={CURSOR_PARAMS} />
          <EnvironmentPageFilter resetParamsOnChange={CURSOR_PARAMS} />
          <DatePageFilter resetParamsOnChange={CURSOR_PARAMS} />
        </PageFilterBar>
      </FlamegraphActionBar>
      <FlamegraphLayout>
        {props.shouldShowProfilingOnboardingPanel ? (
          <ProfilingOnboardingCTA />
        ) : (
          <LandingAggregateFlamegraphContainer>
            <LandingAggregateFlamegraph />
          </LandingAggregateFlamegraphContainer>
        )}
        <FlamegraphSidebar />
      </FlamegraphLayout>
    </FlamegraphMainLayout>
  );
}

function ProfilingTransactionsContent(props: ProfilingTabContentProps) {
  const organization = useOrganization();
  const location = useLocation();
  const {selection} = usePageFilters();

  const fields = ALL_FIELDS;

  const sort = formatSort<FieldType>(decodeScalar(location.query.sort), fields, {
    key: 'count()',
    order: 'desc',
  });

  const cursor = decodeScalar(location.query.cursor);
  const query = decodeScalar(location.query.query, '');

  const transactions = useProfileEvents<FieldType>({
    cursor,
    fields,
    query,
    sort,
    referrer: 'api.profiling.landing-table',
  });

  const transactionsError =
    transactions.status === 'error' ? formatError(transactions.error) : null;

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

  return (
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
        <TransactionSearchQueryBuilder
          projects={selection.projects}
          initialQuery={query}
          onSearch={handleSearch}
          searchSource="profile_landing"
        />
      </ActionBar>
      {props.shouldShowProfilingOnboardingPanel ? (
        <ProfilingOnboardingCTA />
      ) : (
        <Fragment>
          {organization.features.includes('profiling-global-suspect-functions') ? (
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
          <Fragment>
            <TableHeader>
              <TableHeaderTitle>{t('Transactions')}</TableHeaderTitle>
              <TableHeaderActions>
                <StyledPagination
                  pageLinks={
                    transactions.status === 'success'
                      ? transactions.getResponseHeader?.('Link') ?? null
                      : null
                  }
                />
              </TableHeaderActions>
            </TableHeader>
            <ProfileEventsTable
              columns={fields.slice()}
              data={transactions.status === 'success' ? transactions.data : null}
              error={
                transactions.status === 'error' ? t('Unable to load profiles') : null
              }
              isLoading={transactions.status === 'pending'}
              sort={sort}
              sortableColumns={new Set(fields)}
            />
          </Fragment>
        </Fragment>
      )}
    </Layout.Main>
  );
}

function ProfilingOnboardingCTA() {
  const organization = useOrganization();
  // Open the modal on demand
  const onSetupProfilingClick = useCallback(() => {
    trackAnalytics('profiling_views.onboarding', {
      organization,
    });
    SidebarPanelStore.activatePanel(SidebarPanelKey.PROFILING_ONBOARDING);
  }, [organization]);

  return (
    <Fragment>
      <ProfilingOnboardingPanel
        content={
          // If user is on m2, show default
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
          data-test-id="profiling-upgrade"
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
        <LinkButton href="https://docs.sentry.io/product/profiling/" external>
          {t('Read Docs')}
        </LinkButton>
      </ProfilingOnboardingPanel>
    </Fragment>
  );
}

interface ProfilingContentPageHeaderProps {
  onTabChange: (newTab: 'flamegraph' | 'transactions') => void;
  tab: 'flamegraph' | 'transactions';
}

function ProfilingContentPageHeader(props: ProfilingContentPageHeaderProps) {
  return (
    <StyledLayoutHeader>
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
      <div>
        <Tabs value={props.tab} onChange={props.onTabChange}>
          <TabList hideBorder>
            <TabList.Item key="transactions">{t('Transactions')}</TabList.Item>
            <TabList.Item key="flamegraph">{t('Flamegraph')}</TabList.Item>
          </TabList>
        </Tabs>
      </div>
    </StyledLayoutHeader>
  );
}

const ALL_FIELDS = [
  'transaction',
  'project.id',
  'last_seen()',
  'p50()',
  'p75()',
  'p95()',
  'p99()',
  'count()',
] as const;

type FieldType = (typeof ALL_FIELDS)[number];

const FlamegraphBody = styled(Layout.Body)`
  display: grid;
  grid-template-rows: 1fr;
`;

const FlamegraphMainLayout = styled(Layout.Main)`
  display: grid;
  grid-column: 1 / -1;
  grid-template-rows: min-content 1fr;
`;

const FlamegraphLayout = styled('div')`
  display: grid;
  grid-template-areas: 'flamegraph sidebar';
  grid-template-columns: 1fr min-content;
  margin-top: ${space(2)};
`;

const FlamegraphActionBar = styled('div')``;

const FlamegraphSidebar = styled('div')`
  grid-area: sidebar;
`;

const LandingAggregateFlamegraphContainer = styled('div')`
  height: 100%;
  min-height: 300px;
  position: relative;
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  margin-bottom: ${space(2)};
  grid-area: flamegraph;
`;

const StyledLayoutHeader = styled(Layout.Header)`
  display: block;
`;

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

const StyledPagination = styled(Pagination)`
  margin: 0;
`;
