import {Fragment, useCallback, useEffect, useMemo} from 'react';
import {browserHistory, InjectedRouter} from 'react-router';
import styled from '@emotion/styled';
import {Location} from 'history';

import {openModal} from 'sentry/actionCreators/modal';
import Button from 'sentry/components/button';
import DatePageFilter from 'sentry/components/datePageFilter';
import EnvironmentPageFilter from 'sentry/components/environmentPageFilter';
import * as Layout from 'sentry/components/layouts/thirds';
import NoProjectMessage from 'sentry/components/noProjectMessage';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import PageHeading from 'sentry/components/pageHeading';
import Pagination from 'sentry/components/pagination';
import {ProfileTransactionsTable} from 'sentry/components/profiling/profileTransactionsTable';
import {ProfilingOnboardingModal} from 'sentry/components/profiling/ProfilingOnboarding/profilingOnboardingModal';
import ProjectPageFilter from 'sentry/components/projectPageFilter';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import SmartSearchBar, {SmartSearchBarProps} from 'sentry/components/smartSearchBar';
import {MAX_QUERY_LENGTH} from 'sentry/constants';
import {ALL_ACCESS_PROJECTS} from 'sentry/constants/pageFilters';
import {t} from 'sentry/locale';
import {PageContent} from 'sentry/styles/organization';
import space from 'sentry/styles/space';
import {Project} from 'sentry/types';
import {PageFilters} from 'sentry/types/core';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import {useProfileFilters} from 'sentry/utils/profiling/hooks/useProfileFilters';
import {useProfileTransactions} from 'sentry/utils/profiling/hooks/useProfileTransactions';
import {decodeScalar} from 'sentry/utils/queryString';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';

import {ProfileCharts} from './landing/profileCharts';
import {ProfilingOnboardingPanel} from './profilingOnboardingPanel';

function hasSetupProfilingForAtLeastOneProject(
  selectedProjects: PageFilters['projects'],
  projects: Project[]
): boolean {
  const projectIDsToProjectTable = projects.reduce<Record<string, Project>>(
    (acc, project) => {
      acc[project.id] = project;
      return acc;
    },
    {}
  );

  if (selectedProjects[0] === ALL_ACCESS_PROJECTS || selectedProjects.length === 0) {
    const projectWithProfiles = projects.find(p => {
      const project = projectIDsToProjectTable[String(p)];

      if (!project) {
        // Shouldnt happen, but lets be safe and just not do anything
        return false;
      }
      return project.hasProfiles;
    });

    return projectWithProfiles !== undefined;
  }

  const projectWithProfiles = selectedProjects.find(p => {
    const project = projectIDsToProjectTable[String(p)];

    if (!project) {
      // Shouldnt happen, but lets be safe and just not do anything
      return false;
    }
    return project.hasProfiles;
  });

  return projectWithProfiles !== undefined;
}

interface ProfilingContentProps {
  location: Location;
  router: InjectedRouter;
}

function ProfilingContent({location, router}: ProfilingContentProps) {
  const organization = useOrganization();
  const {selection} = usePageFilters();
  const cursor = decodeScalar(location.query.cursor);
  const query = decodeScalar(location.query.query, '');
  const transactionsSort = decodeScalar(location.query.sort, '-count()');
  const profileFilters = useProfileFilters({query: '', selection});
  const transactions = useProfileTransactions({
    cursor,
    query,
    selection,
    sort: transactionsSort,
  });
  const {projects} = useProjects();

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
    openModal(props => {
      return <ProfilingOnboardingModal {...props} organization={organization} />;
    });
  }, [organization]);

  const shouldShowProfilingOnboardingPanel = useMemo((): boolean => {
    if (transactions.type !== 'resolved') {
      return false;
    }

    if (transactions.data.transactions.length > 0) {
      return false;
    }
    return !hasSetupProfilingForAtLeastOneProject(selection.projects, projects);
  }, [selection.projects, projects, transactions]);

  return (
    <SentryDocumentTitle title={t('Profiling')} orgSlug={organization.slug}>
      <PageFiltersContainer>
        <NoProjectMessage organization={organization}>
          <StyledPageContent>
            <Layout.Header>
              <StyledLayoutHeaderContent>
                <StyledHeading>{t('Profiling')}</StyledHeading>
                <HeadingActions>
                  <Button size="sm" onClick={onSetupProfilingClick}>
                    {t('Set Up Profiling')}
                  </Button>
                  <Button
                    size="sm"
                    priority="primary"
                    href="https://discord.gg/zrMjKA4Vnz"
                    external
                    onClick={() => {
                      trackAdvancedAnalyticsEvent(
                        'profiling_views.visit_discord_channel',
                        {
                          organization,
                        }
                      );
                    }}
                  >
                    {t('Join Discord')}
                  </Button>
                </HeadingActions>
              </StyledLayoutHeaderContent>
            </Layout.Header>
            <Layout.Body>
              <Layout.Main fullWidth>
                <ActionBar>
                  <PageFilterBar condensed>
                    <ProjectPageFilter />
                    <EnvironmentPageFilter />
                    <DatePageFilter alignDropdown="left" />
                  </PageFilterBar>
                  <SmartSearchBar
                    organization={organization}
                    hasRecentSearches
                    searchSource="profile_landing"
                    supportedTags={profileFilters}
                    query={query}
                    onSearch={handleSearch}
                    maxQueryLength={MAX_QUERY_LENGTH}
                  />
                </ActionBar>
                {shouldShowProfilingOnboardingPanel ? (
                  <ProfilingOnboardingPanel>
                    <Button href="https://docs.sentry.io/product/profiling/" external>
                      {t('Read Docs')}
                    </Button>
                    <Button onClick={onSetupProfilingClick} priority="primary">
                      {t('Set Up Profiling')}
                    </Button>
                  </ProfilingOnboardingPanel>
                ) : (
                  <Fragment>
                    <ProfileCharts router={router} query={query} selection={selection} />
                    <ProfileTransactionsTable
                      error={
                        transactions.type === 'errored'
                          ? t('Unable to load profiles')
                          : null
                      }
                      isLoading={transactions.type === 'loading'}
                      sort={transactionsSort}
                      transactions={
                        transactions.type === 'resolved'
                          ? transactions.data.transactions
                          : []
                      }
                    />
                    <Pagination
                      pageLinks={
                        transactions.type === 'resolved'
                          ? transactions.data.pageLinks
                          : null
                      }
                    />
                  </Fragment>
                )}
              </Layout.Main>
            </Layout.Body>
          </StyledPageContent>
        </NoProjectMessage>
      </PageFiltersContainer>
    </SentryDocumentTitle>
  );
}

const StyledPageContent = styled(PageContent)`
  padding: 0;
`;

const StyledLayoutHeaderContent = styled(Layout.HeaderContent)`
  display: flex;
  justify-content: space-between;
  flex-direction: row;
`;

const HeadingActions = styled('div')`
  display: flex;
  align-items: center;

  button:not(:last-child) {
    margin-right: ${space(1)};
  }
`;

const StyledHeading = styled(PageHeading)`
  line-height: 40px;
`;

const ActionBar = styled('div')`
  display: grid;
  gap: ${space(2)};
  grid-template-columns: min-content auto;
  margin-bottom: ${space(2)};
`;

export default ProfilingContent;
