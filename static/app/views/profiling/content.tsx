import {useCallback, useEffect} from 'react';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';
import {Location} from 'history';

import Alert from 'sentry/components/alert';
import DatePageFilter from 'sentry/components/datePageFilter';
import EnvironmentPageFilter from 'sentry/components/environmentPageFilter';
import * as Layout from 'sentry/components/layouts/thirds';
import NoProjectMessage from 'sentry/components/noProjectMessage';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import PageHeading from 'sentry/components/pageHeading';
import Pagination from 'sentry/components/pagination';
import {ProfileTransactionsTable} from 'sentry/components/profiling/profileTransactionsTable';
import ProjectPageFilter from 'sentry/components/projectPageFilter';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import SmartSearchBar, {SmartSearchBarProps} from 'sentry/components/smartSearchBar';
import {MAX_QUERY_LENGTH} from 'sentry/constants';
import {t} from 'sentry/locale';
import {PageContent} from 'sentry/styles/organization';
import space from 'sentry/styles/space';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import {useProfileFilters} from 'sentry/utils/profiling/hooks/useProfileFilters';
import {useProfiles} from 'sentry/utils/profiling/hooks/useProfiles';
import {useProfileTransactions} from 'sentry/utils/profiling/hooks/useProfileTransactions';
import {decodeScalar} from 'sentry/utils/queryString';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';

import {ProfilingScatterChart} from './landing/profilingScatterChart';

interface ProfilingContentProps {
  location: Location;
}

function ProfilingContent({location}: ProfilingContentProps) {
  const organization = useOrganization();
  const {selection} = usePageFilters();
  const cursor = decodeScalar(location.query.cursor);
  const query = decodeScalar(location.query.query, '');
  const profileFilters = useProfileFilters({query: '', selection});
  const profiles = useProfiles({cursor, query, selection});
  const transactions = useProfileTransactions({cursor, query, selection});

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

  return (
    <SentryDocumentTitle title={t('Profiling')} orgSlug={organization.slug}>
      <PageFiltersContainer>
        <NoProjectMessage organization={organization}>
          <StyledPageContent>
            <Layout.Header>
              <Layout.HeaderContent>
                <StyledHeading>{t('Profiling')}</StyledHeading>
              </Layout.HeaderContent>
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
                {profiles.type === 'errored' && (
                  <Alert type="error" showIcon>
                    {t('Unable to load profiles')}
                  </Alert>
                )}
                <ProfilingScatterChart
                  datetime={
                    selection?.datetime ?? {
                      start: null,
                      end: null,
                      period: null,
                      utc: null,
                    }
                  }
                  traces={profiles.type === 'resolved' ? profiles.data.traces : []}
                  isLoading={profiles.type === 'loading'}
                />
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
