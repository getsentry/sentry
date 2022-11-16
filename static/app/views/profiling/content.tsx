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
import {ProfileEventsTable} from 'sentry/components/profiling/profileEventsTable';
import {ProfilingOnboardingModal} from 'sentry/components/profiling/ProfilingOnboarding/profilingOnboardingModal';
import ProjectPageFilter from 'sentry/components/projectPageFilter';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {SidebarPanelKey} from 'sentry/components/sidebar/types';
import SmartSearchBar, {SmartSearchBarProps} from 'sentry/components/smartSearchBar';
import {MAX_QUERY_LENGTH} from 'sentry/constants';
import {ALL_ACCESS_PROJECTS} from 'sentry/constants/pageFilters';
import {t} from 'sentry/locale';
import SidebarPanelStore from 'sentry/stores/sidebarPanelStore';
import {PageContent} from 'sentry/styles/organization';
import space from 'sentry/styles/space';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import {
  formatSort,
  useProfileEvents,
} from 'sentry/utils/profiling/hooks/useProfileEvents';
import {useProfileFilters} from 'sentry/utils/profiling/hooks/useProfileFilters';
import {decodeScalar} from 'sentry/utils/queryString';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';

import {ProfileCharts} from './landing/profileCharts';
import {ProfilingOnboardingPanel} from './profilingOnboardingPanel';

interface ProfilingContentProps {
  location: Location;
  router: InjectedRouter;
}

function ProfilingContent({location, router}: ProfilingContentProps) {
  const organization = useOrganization();
  const {selection} = usePageFilters();
  const cursor = decodeScalar(location.query.cursor);
  const query = decodeScalar(location.query.query, '');

  const sort = formatSort<FieldType>(decodeScalar(location.query.sort), FIELDS, {
    key: 'count()',
    order: 'desc',
  });

  const profileFilters = useProfileFilters({query: '', selection});
  const {projects} = useProjects();

  const transactions = useProfileEvents<FieldType>({
    cursor,
    fields: FIELDS,
    query,
    sort,
    referrer: 'api.profiling.landing-table',
  });

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
    const profilingOnboardingChecklistEnabled = organization.features?.includes(
      'profiling-onboarding-checklist'
    );
    if (profilingOnboardingChecklistEnabled) {
      SidebarPanelStore.activatePanel(SidebarPanelKey.ProfilingOnboarding);
      return;
    }
    openModal(props => {
      return <ProfilingOnboardingModal {...props} organization={organization} />;
    });
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
                    <ProfileEventsTable
                      columns={FIELDS.slice()}
                      data={
                        transactions.status === 'success' ? transactions.data[0] : null
                      }
                      error={
                        transactions.status === 'error'
                          ? t('Unable to load profiles')
                          : null
                      }
                      isLoading={transactions.status === 'loading'}
                      sort={sort}
                      sortableColumns={new Set(FIELDS)}
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
          </StyledPageContent>
        </NoProjectMessage>
      </PageFiltersContainer>
    </SentryDocumentTitle>
  );
}

const FIELDS = [
  'transaction',
  'project.id',
  'last_seen()',
  'p75()',
  'p95()',
  'p99()',
  'count()',
] as const;

type FieldType = typeof FIELDS[number];

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
