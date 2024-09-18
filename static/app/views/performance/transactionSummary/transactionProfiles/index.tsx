import {useCallback, useMemo} from 'react';
import styled from '@emotion/styled';

import SearchBar from 'sentry/components/events/searchBar';
import * as Layout from 'sentry/components/layouts/thirds';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {TransactionSearchQueryBuilder} from 'sentry/components/performance/transactionSearchQueryBuilder';
import {ProfileEventsTable} from 'sentry/components/profiling/profileEventsTable';
import type {SmartSearchBarProps} from 'sentry/components/smartSearchBar';
import {MAX_QUERY_LENGTH} from 'sentry/constants';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import {browserHistory} from 'sentry/utils/browserHistory';
import EventView from 'sentry/utils/discover/eventView';
import {isAggregateField} from 'sentry/utils/discover/fields';
import type {ProfilingFieldType} from 'sentry/utils/profiling/hooks/useProfileEvents';
import {
  getProfilesTableFields,
  useProfileEvents,
} from 'sentry/utils/profiling/hooks/useProfileEvents';
import {formatSort} from 'sentry/utils/profiling/hooks/utils';
import {decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import Tab from 'sentry/views/performance/transactionSummary/tabs';

import PageLayout, {redirectToPerformanceHomepage} from '../pageLayout';

import {TransactionProfilesContent} from './content';

interface ProfilesProps {
  organization: Organization;
  transaction: string;
}

function ProfilesLegacy({organization, transaction}: ProfilesProps) {
  const location = useLocation();
  const {projects} = useProjects();

  const profilesCursor = useMemo(
    () => decodeScalar(location.query.cursor),
    [location.query.cursor]
  );

  const project = projects.find(p => p.id === location.query.project);
  const fields = getProfilesTableFields(project?.platform);
  const sortableFields = useMemo(() => new Set(fields), [fields]);

  const sort = formatSort<ProfilingFieldType>(decodeScalar(location.query.sort), fields, {
    key: 'timestamp',
    order: 'desc',
  });

  const rawQuery = useMemo(
    () => decodeScalar(location.query.query, ''),
    [location.query.query]
  );

  const query = useMemo(() => {
    const conditions = new MutableSearch(rawQuery);
    conditions.setFilterValues('event.type', ['transaction']);
    conditions.setFilterValues('transaction', [transaction]);

    Object.keys(conditions.filters).forEach(field => {
      if (isAggregateField(field)) {
        conditions.removeFilter(field);
      }
    });

    return conditions.formatString();
  }, [transaction, rawQuery]);

  const profiles = useProfileEvents<ProfilingFieldType>({
    cursor: profilesCursor,
    fields,
    query,
    sort,
    limit: 30,
    referrer: 'api.profiling.transactions-profiles-table',
  });

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

  const projectIds = useMemo(
    () => (project ? [parseInt(project?.id, 10)] : undefined),
    [project]
  );

  return (
    <PageLayout
      location={location}
      organization={organization}
      projects={projects}
      tab={Tab.PROFILING}
      generateEventView={() => EventView.fromLocation(location)}
      getDocumentTitle={() => t(`Profile: %s`, transaction)}
      childComponent={() => {
        return (
          <Layout.Main fullWidth>
            <FilterActions>
              <PageFilterBar condensed>
                <EnvironmentPageFilter />
                <DatePageFilter />
              </PageFilterBar>
              {organization.features.includes('search-query-builder-performance') ? (
                <TransactionSearchQueryBuilder
                  projects={projectIds}
                  initialQuery={rawQuery}
                  onSearch={handleSearch}
                  searchSource="transaction_profiles"
                />
              ) : (
                <SearchBar
                  searchSource="transaction_profiles"
                  organization={organization}
                  projectIds={projects.map(p => parseInt(p.id, 10))}
                  query={rawQuery}
                  onSearch={handleSearch}
                  maxQueryLength={MAX_QUERY_LENGTH}
                />
              )}
            </FilterActions>
            <ProfileEventsTable
              columns={fields}
              data={profiles.status === 'success' ? profiles.data : null}
              error={profiles.status === 'error' ? t('Unable to load profiles') : null}
              isLoading={profiles.status === 'pending'}
              sort={sort}
              sortableColumns={sortableFields}
            />
          </Layout.Main>
        );
      }}
    />
  );
}

function Profiles({organization, transaction}: ProfilesProps) {
  const location = useLocation();
  const {projects} = useProjects();

  const project = projects.find(p => p.id === location.query.project);

  const rawQuery = useMemo(
    () => decodeScalar(location.query.query, ''),
    [location.query.query]
  );

  const query = useMemo(() => {
    const conditions = new MutableSearch(rawQuery);
    conditions.setFilterValues('event.type', ['transaction']);
    conditions.setFilterValues('transaction', [transaction]);

    Object.keys(conditions.filters).forEach(field => {
      if (isAggregateField(field)) {
        conditions.removeFilter(field);
      }
    });

    return conditions.formatString();
  }, [transaction, rawQuery]);

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

  const projectIds = useMemo(
    () => (project ? [parseInt(project?.id, 10)] : undefined),
    [project]
  );

  return (
    <PageLayout
      location={location}
      organization={organization}
      projects={projects}
      tab={Tab.PROFILING}
      generateEventView={() => EventView.fromLocation(location)}
      getDocumentTitle={() => t(`Profile: %s`, transaction)}
      fillSpace
      childComponent={() => {
        return (
          <StyledMain fullWidth>
            <FilterActions>
              <PageFilterBar condensed>
                <EnvironmentPageFilter />
                <DatePageFilter />
              </PageFilterBar>
              {organization.features.includes('search-query-builder-performance') ? (
                <TransactionSearchQueryBuilder
                  projects={projectIds}
                  initialQuery={rawQuery}
                  onSearch={handleSearch}
                  searchSource="transaction_profiles"
                />
              ) : (
                <SearchBar
                  searchSource="transaction_profiles"
                  organization={organization}
                  projectIds={projectIds}
                  query={rawQuery}
                  onSearch={handleSearch}
                  maxQueryLength={MAX_QUERY_LENGTH}
                />
              )}
            </FilterActions>
            <TransactionProfilesContent query={query} transaction={transaction} />
          </StyledMain>
        );
      }}
    />
  );
}

const FilterActions = styled('div')`
  margin-bottom: ${space(2)};
  gap: ${space(2)};
  display: grid;
  grid-template-columns: min-content 1fr;
`;

const StyledMain = styled(Layout.Main)`
  display: flex;
  flex-direction: column;
  flex: 1;
`;

function ProfilesIndex() {
  const organization = useOrganization();
  const location = useLocation();
  const transaction = decodeScalar(location.query.transaction);

  if (!transaction) {
    redirectToPerformanceHomepage(organization, location);
    return null;
  }

  if (organization.features.includes('continuous-profiling-compat')) {
    return <Profiles organization={organization} transaction={transaction} />;
  }

  return <ProfilesLegacy organization={organization} transaction={transaction} />;
}

export default ProfilesIndex;
