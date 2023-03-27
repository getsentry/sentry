import {Fragment, useCallback, useEffect, useMemo} from 'react';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';
import {Location} from 'history';

import {Alert} from 'sentry/components/alert';
import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import DatePageFilter from 'sentry/components/datePageFilter';
import EnvironmentPageFilter from 'sentry/components/environmentPageFilter';
import SearchBar from 'sentry/components/events/searchBar';
import FeatureBadge from 'sentry/components/featureBadge';
import * as Layout from 'sentry/components/layouts/thirds';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import {PageHeadingQuestionTooltip} from 'sentry/components/pageHeadingQuestionTooltip';
import Pagination from 'sentry/components/pagination';
import {ProfileEventsTable} from 'sentry/components/profiling/profileEventsTable';
import ProjectPageFilter from 'sentry/components/projectPageFilter';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {SidebarPanelKey} from 'sentry/components/sidebar/types';
import SmartSearchBar, {SmartSearchBarProps} from 'sentry/components/smartSearchBar';
import {MAX_QUERY_LENGTH} from 'sentry/constants';
import {ALL_ACCESS_PROJECTS} from 'sentry/constants/pageFilters';
import {t} from 'sentry/locale';
import SidebarPanelStore from 'sentry/stores/sidebarPanelStore';
import {space} from 'sentry/styles/space';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import EventView from 'sentry/utils/discover/eventView';
import {
  formatError,
  formatSort,
  useProfileEvents,
} from 'sentry/utils/profiling/hooks/useProfileEvents';
import {useProfileFilters} from 'sentry/utils/profiling/hooks/useProfileFilters';
import {decodeScalar} from 'sentry/utils/queryString';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';
import {DEFAULT_PROFILING_DATETIME_SELECTION} from 'sentry/views/profiling/utils';

import {ProfileCharts} from './landing/profileCharts';
import {ProfilingSlowestTransactionsPanel} from './landing/profilingSlowestTransactionsPanel';
import {ProfilingOnboardingPanel} from './profilingOnboardingPanel';

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
    key: 'p99()',
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
    trackAdvancedAnalyticsEvent('profiling_views.landing', {
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
    trackAdvancedAnalyticsEvent('profiling_views.onboarding', {
      organization,
    });
    SidebarPanelStore.activatePanel(SidebarPanelKey.ProfilingOnboarding);
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
          <Layout.Header>
            <Layout.HeaderContent>
              <Layout.Title>
                {t('Profiling')}
                <PageHeadingQuestionTooltip
                  docsUrl="https://docs.sentry.io/product/profiling/"
                  title={t(
                    'A view of how your application performs in a variety of environments, based off of the performance profiles collected from real user devices in production.'
                  )}
                />
                <FeatureBadge type="beta" />
              </Layout.Title>
            </Layout.HeaderContent>
            <Layout.HeaderActions>
              <ButtonBar gap={1}>
                <Button size="sm" onClick={onSetupProfilingClick}>
                  {t('Set Up Profiling')}
                </Button>
                <Button
                  size="sm"
                  priority="primary"
                  href="https://discord.gg/zrMjKA4Vnz"
                  external
                  onClick={() => {
                    trackAdvancedAnalyticsEvent('profiling_views.visit_discord_channel', {
                      organization,
                    });
                  }}
                >
                  {t('Join Discord')}
                </Button>
              </ButtonBar>
            </Layout.HeaderActions>
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
                  <ProjectPageFilter />
                  <EnvironmentPageFilter />
                  <DatePageFilter alignDropdown="left" />
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
                <ProfilingOnboardingPanel>
                  <Button onClick={onSetupProfilingClick} priority="primary">
                    {t('Set Up Profiling')}
                  </Button>
                  <Button href="https://docs.sentry.io/product/profiling/" external>
                    {t('Read Docs')}
                  </Button>
                </ProfilingOnboardingPanel>
              ) : (
                <Fragment>
                  <PanelsGrid>
                    <ProfilingSlowestTransactionsPanel />
                    <ProfileCharts query={query} selection={selection} hideCount />
                  </PanelsGrid>
                  <ProfileEventsTable
                    columns={fields.slice()}
                    data={transactions.status === 'success' ? transactions.data[0] : null}
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
                        ? transactions.data?.[2]?.getResponseHeader('Link') ?? null
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

export default ProfilingContent;
