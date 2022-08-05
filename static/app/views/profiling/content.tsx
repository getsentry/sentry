import {useCallback, useEffect} from 'react';
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
import {t} from 'sentry/locale';
import {PageContent} from 'sentry/styles/organization';
import space from 'sentry/styles/space';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import {useProfileFilters} from 'sentry/utils/profiling/hooks/useProfileFilters';
import {useProfileTransactions} from 'sentry/utils/profiling/hooks/useProfileTransactions';
import {useProfilingOnboarding} from 'sentry/utils/profiling/hooks/useProfilingOnboarding';
import {decodeScalar} from 'sentry/utils/queryString';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';

import {ProfileCharts} from './landing/profileCharts';

interface ProfilingContentProps {
  location: Location;
  router: InjectedRouter;
}

function ProfilingContent({location, router}: ProfilingContentProps) {
  const organization = useOrganization();
  const {selection} = usePageFilters();
  const cursor = decodeScalar(location.query.cursor);
  const query = decodeScalar(location.query.query, '');
  const profileFilters = useProfileFilters({query: '', selection});
  const transactions = useProfileTransactions({cursor, query, selection});

  const [onboardingRequestState, onOnboardingDismiss] = useProfilingOnboarding();

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

  // Check if we want to force open the modal in case the user has never seen it before
  useEffect(() => {
    if (onboardingRequestState.type !== 'resolved') {
      return;
    }

    if (onboardingRequestState?.data?.dismissedTime === undefined) {
      openModal(props => {
        return <ProfilingOnboardingModal onDismiss={onOnboardingDismiss} {...props} />;
      });
    }
  }, [onboardingRequestState, onOnboardingDismiss]);

  // Open the modal on demand
  const onSetupProfilingClick = useCallback(() => {
    openModal(props => {
      return <ProfilingOnboardingModal onDismiss={onOnboardingDismiss} {...props} />;
    });
  }, [onOnboardingDismiss]);

  return (
    <SentryDocumentTitle title={t('Profiling')} orgSlug={organization.slug}>
      <PageFiltersContainer>
        <NoProjectMessage organization={organization}>
          <StyledPageContent>
            <Layout.Header>
              <StyledLayoutHeaderContent>
                <StyledHeading>{t('Profiling')}</StyledHeading>
                <Button onClick={onSetupProfilingClick}>Set Up Profiling</Button>
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
                <ProfileCharts router={router} query={query} selection={selection} />
                <ProfileTransactionsTable
                  error={
                    transactions.type === 'errored' ? t('Unable to load profiles') : null
                  }
                  isLoading={transactions.type === 'loading'}
                  transactions={
                    transactions.type === 'resolved' ? transactions.data.transactions : []
                  }
                />
                <Pagination
                  pageLinks={
                    transactions.type === 'resolved' ? transactions.data.pageLinks : null
                  }
                />
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
