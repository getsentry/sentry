import {Fragment, useCallback, useEffect, useMemo} from 'react';
import styled from '@emotion/styled';
import type {Location} from 'history';

import Feature from 'sentry/components/acl/feature';
import {Alert} from 'sentry/components/core/alert';
import {TabList, Tabs} from 'sentry/components/core/tabs';
import FeedbackButton from 'sentry/components/feedbackButton/feedbackButton';
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
  ContinuousProfilingBetaAlertBanner,
  ContinuousProfilingBetaSDKAlertBanner,
  ProfilingBetaAlertBanner,
} from 'sentry/components/profiling/billing/alerts';
import {ProfileEventsTable} from 'sentry/components/profiling/profileEventsTable';
import QuestionTooltip from 'sentry/components/questionTooltip';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {ALL_ACCESS_PROJECTS} from 'sentry/constants/pageFilters';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {DataCategory} from 'sentry/types/core';
import type {PageFilters} from 'sentry/types/core';
import type {Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import {browserHistory} from 'sentry/utils/browserHistory';
import {useProfileEvents} from 'sentry/utils/profiling/hooks/useProfileEvents';
import {formatError, formatSort} from 'sentry/utils/profiling/hooks/utils';
import {decodeScalar} from 'sentry/utils/queryString';
import {useDatePageFilterProps} from 'sentry/utils/useDatePageFilterProps';
import {useLocation} from 'sentry/utils/useLocation';
import {useMaxPickableDays} from 'sentry/utils/useMaxPickableDays';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';
import {LandingAggregateFlamegraph} from 'sentry/views/profiling/landingAggregateFlamegraph';
import {Onboarding} from 'sentry/views/profiling/onboarding';

import {LandingWidgetSelector} from './landing/landingWidgetSelector';
import type {DataState} from './useLandingAnalytics';
import {useLandingAnalytics} from './useLandingAnalytics';

const LEFT_WIDGET_CURSOR = 'leftCursor';
const RIGHT_WIDGET_CURSOR = 'rightCursor';
const CURSOR_PARAMS = [LEFT_WIDGET_CURSOR, RIGHT_WIDGET_CURSOR];

function validateTab(tab: unknown): tab is 'flamegraph' | 'transactions' {
  return tab === 'flamegraph' || tab === 'transactions';
}

function decodeTab(tab: unknown): 'flamegraph' | 'transactions' {
  // Fallback to transactions if tab is invalid. We default to transactions
  // because that is going to be the most common perf setup when we release.
  return validateTab(tab) ? tab : 'transactions';
}

export default function ProfilingContent() {
  const {selection} = usePageFilters();
  const organization = useOrganization();
  const {projects} = useProjects();
  const location = useLocation();

  const dispatchDataState = useLandingAnalytics();
  const updateWidget1DataState = useCallback(
    (dataState: DataState) =>
      dispatchDataState({
        dataKey: 'widget1Data',
        dataState,
      }),
    [dispatchDataState]
  );
  const updateWidget2DataState = useCallback(
    (dataState: DataState) =>
      dispatchDataState({
        dataKey: 'widget2Data',
        dataState,
      }),
    [dispatchDataState]
  );
  const updateFlamegraphDataState = useCallback(
    (dataState: DataState) =>
      dispatchDataState({
        dataKey: 'flamegraphData',
        dataState,
      }),
    [dispatchDataState]
  );
  const updateTransactionsTableDataState = useCallback(
    (dataState: DataState) =>
      dispatchDataState({
        dataKey: 'transactionsTableData',
        dataState,
      }),
    [dispatchDataState]
  );

  const showOnboardingPanel = useMemo(() => {
    return shouldShowProfilingOnboardingPanel(selection, projects);
  }, [selection, projects]);

  const tab = decodeTab(location.query.tab);

  const onTabChange = useCallback(
    (newTab: 'flamegraph' | 'transactions') => {
      // make sure to reset the state of the tabs
      dispatchDataState({
        dataKey: 'flamegraphData',
        dataState: 'pending',
      });
      dispatchDataState({
        dataKey: 'transactionsTableData',
        dataState: 'pending',
      });

      trackAnalytics('profiling_views.landing.tab_change', {
        organization,
        tab: newTab,
      });
      browserHistory.push({
        ...location,
        query: {
          ...location.query,
          tab: newTab,
        },
      });
    },
    [dispatchDataState, location, organization]
  );

  const maxPickableDays = useMaxPickableDays({
    dataCategories: [DataCategory.PROFILE_DURATION, DataCategory.PROFILE_DURATION_UI],
  });
  const datePageFilterProps = useDatePageFilterProps(maxPickableDays);

  return (
    <SentryDocumentTitle title={t('Profiling')} orgSlug={organization.slug}>
      <PageFiltersContainer
        maxPickableDays={datePageFilterProps.maxPickableDays}
        defaultSelection={
          datePageFilterProps.defaultPeriod
            ? {
                datetime: {
                  period: datePageFilterProps.defaultPeriod,
                  start: null,
                  end: null,
                  utc: null,
                },
              }
            : undefined
        }
      >
        <Layout.Page>
          <ProfilingBetaAlertBanner organization={organization} />
          <Feature features="continuous-profiling-beta-ui">
            <ContinuousProfilingBetaAlertBanner organization={organization} />
            <ContinuousProfilingBetaSDKAlertBanner />
          </Feature>
          <ProfilingContentPageHeader />
          <LayoutBody>
            <LayoutMain width="full">
              <ActionBar>
                <PageFilterBar condensed>
                  <ProjectPageFilter resetParamsOnChange={CURSOR_PARAMS} />
                  <EnvironmentPageFilter resetParamsOnChange={CURSOR_PARAMS} />
                  <DatePageFilter
                    {...datePageFilterProps}
                    resetParamsOnChange={CURSOR_PARAMS}
                  />
                </PageFilterBar>
              </ActionBar>
              {showOnboardingPanel ? (
                <Onboarding />
              ) : (
                <Fragment>
                  {organization.features.includes(
                    'profiling-global-suspect-functions'
                  ) && (
                    <WidgetsContainer>
                      <LandingWidgetSelector
                        cursorName={LEFT_WIDGET_CURSOR}
                        widgetHeight="410px"
                        defaultWidget="slowest functions"
                        storageKey="profiling-landing-widget-0"
                        onDataState={updateWidget1DataState}
                      />
                      <LandingWidgetSelector
                        cursorName={RIGHT_WIDGET_CURSOR}
                        widgetHeight="410px"
                        defaultWidget={
                          organization.features.includes('profiling-function-trends')
                            ? 'regressed functions'
                            : 'slowest functions avg'
                        }
                        storageKey="profiling-landing-widget-1"
                        onDataState={updateWidget2DataState}
                      />
                    </WidgetsContainer>
                  )}
                  <div>
                    <Tabs value={tab} onChange={onTabChange}>
                      <TabList>
                        <TabList.Item key="transactions">
                          {t('Transactions')}
                          <StyledQuestionTooltip
                            position="top"
                            size="sm"
                            title={t(
                              'Transactions breakdown the profiling data by transactions to provide a more focused view of the data. It allows you to view an aggregate flamegraph for just that transaction and find specific examples.'
                            )}
                          />
                        </TabList.Item>
                        <TabList.Item key="flamegraph">
                          {t('Aggregate Flamegraph')}
                          <StyledQuestionTooltip
                            position="top"
                            size="sm"
                            title={t(
                              'Aggregate flamegraphs are a visual representation of stacktraces that helps identify where a program spends its time. Look for the widest stacktraces as they indicate where your application is spending more time.'
                            )}
                          />
                        </TabList.Item>
                      </TabList>
                    </Tabs>
                  </div>
                  {tab === 'flamegraph' ? (
                    <FlamegraphTab onDataState={updateFlamegraphDataState} />
                  ) : (
                    <TransactionsTab
                      location={location}
                      selection={selection}
                      onDataState={updateTransactionsTableDataState}
                    />
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

interface ProfilingTabProps {
  onDataState?: (dataState: DataState) => void;
}

interface TabbedContentProps extends ProfilingTabProps {
  location: Location;
  selection: PageFilters;
}

function TransactionsTab({onDataState, location, selection}: TabbedContentProps) {
  const query = decodeScalar(location.query.query, '');
  const handleSearch = useCallback(
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

  const hasData = (transactions.data?.data?.length || 0) > 0;
  const isLoading = transactions.isPending;
  const isError = transactions.isError;

  useEffect(() => {
    if (onDataState) {
      if (isLoading) {
        onDataState('loading');
      } else if (isError) {
        onDataState('errored');
      } else if (hasData) {
        onDataState('populated');
      } else {
        onDataState('empty');
      }
    }
  }, [onDataState, hasData, isLoading, isError]);

  return (
    <Fragment>
      <SearchbarContainer>
        <TransactionSearchQueryBuilder
          projects={selection.projects}
          initialQuery={query}
          onSearch={handleSearch}
          searchSource="profile_landing"
          disallowFreeText={false}
        />
      </SearchbarContainer>
      {transactionsError && (
        <Alert.Container>
          <Alert type="error">{transactionsError}</Alert>
        </Alert.Container>
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
            ? (transactions.getResponseHeader?.('Link') ?? null)
            : null
        }
      />
    </Fragment>
  );
}

function FlamegraphTab({onDataState}: ProfilingTabProps) {
  return (
    <LandingAggregateFlamegraphSizer>
      <LandingAggregateFlamegraphContainer>
        <LandingAggregateFlamegraph onDataState={onDataState} />
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

function ProfilingContentPageHeader() {
  return (
    <StyledLayoutHeader unified>
      <StyledHeaderContent unified>
        <Layout.Title>
          {t('Profiling')}
          <PageHeadingQuestionTooltip
            docsUrl="https://docs.sentry.io/product/profiling/"
            title={t(
              'Profiling collects detailed information in production about the functions executing in your application and how long they take to run, giving you code-level visibility into your hot paths.'
            )}
          />
        </Layout.Title>
        <FeedbackButton />
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

  @media (min-width: ${p => p.theme.breakpoints.lg}) {
    align-content: stretch;
  }
`;

const LayoutMain = styled(Layout.Main)`
  display: flex;
  flex-direction: column;
`;

const LandingAggregateFlamegraphSizer = styled('div')`
  height: 100%;
  min-height: max(80vh, 300px);
  margin-bottom: ${space(2)};
  margin-top: ${space(2)};
`;

const LandingAggregateFlamegraphContainer = styled('div')`
  height: 100%;
  position: relative;
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.radius.md};
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
  @media (max-width: ${p => p.theme.breakpoints.sm}) {
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

const StyledQuestionTooltip = styled(QuestionTooltip)`
  margin-left: ${space(0.5)};
`;
