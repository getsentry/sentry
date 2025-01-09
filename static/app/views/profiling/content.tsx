import {Fragment, useCallback, useEffect, useMemo} from 'react';
import styled from '@emotion/styled';
import type {Location} from 'history';

import {Alert} from 'sentry/components/alert';
import {Button, LinkButton} from 'sentry/components/button';
import type {SmartSearchBarProps} from 'sentry/components/deprecatedSmartSearchBar';
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
import {TabList, Tabs} from 'sentry/components/tabs';
import {ALL_ACCESS_PROJECTS} from 'sentry/constants/pageFilters';
import {t} from 'sentry/locale';
import SidebarPanelStore from 'sentry/stores/sidebarPanelStore';
import {space} from 'sentry/styles/space';
import type {PageFilters} from 'sentry/types/core';
import type {Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import {browserHistory} from 'sentry/utils/browserHistory';
import {useProfileEvents} from 'sentry/utils/profiling/hooks/useProfileEvents';
import {formatError, formatSort} from 'sentry/utils/profiling/hooks/utils';
import {decodeScalar} from 'sentry/utils/queryString';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';
import {LandingAggregateFlamegraph} from 'sentry/views/profiling/landingAggregateFlamegraph';
import {DEFAULT_PROFILING_DATETIME_SELECTION} from 'sentry/views/profiling/utils';

import {LandingWidgetSelector} from './landing/landingWidgetSelector';
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
  const {selection} = usePageFilters();
  const organization = useOrganization();
  const {projects} = useProjects();

  useEffect(() => {
    trackAnalytics('profiling_views.landing', {
      organization,
    });
  }, [organization]);

  const showOnboardingPanel = useMemo(() => {
    return shouldShowProfilingOnboardingPanel(selection, projects);
  }, [selection, projects]);

  const tab = decodeTab(location.query.tab);

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

  return (
    <SentryDocumentTitle title={t('Profiling')} orgSlug={organization.slug}>
      <PageFiltersContainer
        defaultSelection={{datetime: DEFAULT_PROFILING_DATETIME_SELECTION}}
      >
        <Layout.Page>
          <ProfilingBetaAlertBanner organization={organization} />
          <ProfilingContentPageHeader />
          <LayoutBody>
            <LayoutMain fullWidth>
              <ActionBar>
                <PageFilterBar condensed>
                  <ProjectPageFilter resetParamsOnChange={CURSOR_PARAMS} />
                  <EnvironmentPageFilter resetParamsOnChange={CURSOR_PARAMS} />
                  <DatePageFilter resetParamsOnChange={CURSOR_PARAMS} />
                </PageFilterBar>
              </ActionBar>
              {showOnboardingPanel ? (
                <ProfilingOnboardingCTA />
              ) : (
                <Fragment>
                  {organization.features.includes(
                    'profiling-global-suspect-functions'
                  ) && (
                    <WidgetsContainer>
                      <LandingWidgetSelector
                        cursorName={LEFT_WIDGET_CURSOR}
                        widgetHeight="340px"
                        defaultWidget="slowest functions"
                        storageKey="profiling-landing-widget-0"
                      />
                      <LandingWidgetSelector
                        cursorName={RIGHT_WIDGET_CURSOR}
                        widgetHeight="340px"
                        defaultWidget="regressed functions"
                        storageKey="profiling-landing-widget-1"
                      />
                    </WidgetsContainer>
                  )}
                  <div>
                    <Tabs value={tab} onChange={onTabChange}>
                      <TabList hideBorder>
                        <TabList.Item key="transactions">
                          {t('Transactions')}
                        </TabList.Item>
                        <TabList.Item key="flamegraph">{t('Flamegraph')}</TabList.Item>
                      </TabList>
                    </Tabs>
                  </div>
                  {tab === 'flamegraph' ? (
                    <FlamegraphTab location={location} selection={selection} />
                  ) : (
                    <TransactionsTab location={location} selection={selection} />
                  )}
                </Fragment>
              )}
            </LayoutMain>
          </LayoutBody>
        </Layout.Page>
      </PageFiltersContainer>
    </SentryDocumentTitle>
  );
}

interface TabbedContentProps {
  location: Location;
  selection: PageFilters;
}

function TransactionsTab({location, selection}: TabbedContentProps) {
  const query = decodeScalar(location.query.query, '');
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

  const fields = ALL_FIELDS;

  const sort = formatSort<FieldType>(decodeScalar(location.query.sort), fields, {
    key: 'count()',
    order: 'desc',
  });

  const cursor = decodeScalar(location.query.cursor);

  const transactions = useProfileEvents<FieldType>({
    cursor,
    fields,
    query,
    sort,
    limit: 50,
    referrer: 'api.profiling.landing-table',
  });

  const transactionsError =
    transactions.status === 'error' ? formatError(transactions.error) : '';

  return (
    <Fragment>
      <SearchbarContainer>
        <TransactionSearchQueryBuilder
          projects={selection.projects}
          initialQuery={query}
          onSearch={handleSearch}
          searchSource="profile_landing"
        />
      </SearchbarContainer>
      {transactionsError && (
        <Alert type="error" showIcon>
          {transactionsError}
        </Alert>
      )}
      <ProfileEventsTable
        columns={fields.slice()}
        data={transactions.status === 'success' ? transactions.data : null}
        error={transactions.status === 'error' ? t('Unable to load profiles') : null}
        isLoading={transactions.status === 'pending'}
        sort={sort}
        sortableColumns={new Set(fields)}
      />
      <StyledPagination
        pageLinks={
          transactions.status === 'success'
            ? transactions.getResponseHeader?.('Link') ?? null
            : null
        }
      />
    </Fragment>
  );
}

function FlamegraphTab({}: TabbedContentProps) {
  return (
    <LandingAggregateFlamegraphSizer>
      <LandingAggregateFlamegraphContainer>
        <LandingAggregateFlamegraph />
      </LandingAggregateFlamegraphContainer>
    </LandingAggregateFlamegraphSizer>
  );
}

function shouldShowProfilingOnboardingPanel(selection: PageFilters, projects: Project[]) {
  // if it's My Projects or All projects, only show onboarding if we can't
  // find any projects with profiles
  if (selection.projects.length === 0 || selection.projects[0] === ALL_ACCESS_PROJECTS) {
    return projects.every(project => !project.hasProfiles);
  }

  // otherwise, only show onboarding if we can't find any projects with profiles
  // from those that were selected
  const projectsWithProfiles = new Set(
    projects.filter(project => project.hasProfiles).map(project => project.id)
  );
  return selection.projects.every(project => !projectsWithProfiles.has(String(project)));
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

function ProfilingContentPageHeader() {
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

const LayoutBody = styled(Layout.Body)`
  display: grid;
  align-content: stretch;

  @media (min-width: ${p => p.theme.breakpoints.large}) {
    align-content: stretch;
  }
`;

const LayoutMain = styled(Layout.Main)`
  display: flex;
  flex-direction: column;
`;

const LandingAggregateFlamegraphSizer = styled('div')`
  height: 100%;
  min-height: max(50vh, 300px);
  margin-bottom: ${space(2)};
  margin-top: ${space(2)};
`;

const LandingAggregateFlamegraphContainer = styled('div')`
  height: 100%;
  position: relative;
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
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

const WidgetsContainer = styled('div')`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: ${space(2)};
  @media (max-width: ${p => p.theme.breakpoints.small}) {
    grid-template-columns: 1fr;
  }
`;

const SearchbarContainer = styled('div')`
  margin-top: ${space(3)};
  margin-bottom: ${space(2)};
`;

const StyledPagination = styled(Pagination)`
  margin: 0;
`;
