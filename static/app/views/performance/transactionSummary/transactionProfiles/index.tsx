import {useCallback, useMemo, useState} from 'react';
import styled from '@emotion/styled';

import SearchBar from 'sentry/components/events/searchBar';
import * as Layout from 'sentry/components/layouts/thirds';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {ProfileEventsTable} from 'sentry/components/profiling/profileEventsTable';
import type {SmartSearchBarProps} from 'sentry/components/smartSearchBar';
import {MAX_QUERY_LENGTH} from 'sentry/constants';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import {defined} from 'sentry/utils';
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

function ProfilesLegacy() {
  const location = useLocation();
  const organization = useOrganization();
  const projects = useProjects();

  const profilesCursor = useMemo(
    () => decodeScalar(location.query.cursor),
    [location.query.cursor]
  );

  const project = projects.projects.find(p => p.id === location.query.project);
  const fields = getProfilesTableFields(project?.platform);
  const sortableFields = useMemo(() => new Set(fields), [fields]);

  const sort = formatSort<ProfilingFieldType>(decodeScalar(location.query.sort), fields, {
    key: 'timestamp',
    order: 'desc',
  });

  const [query, setQuery] = useState(() => {
    // The search fields from the URL differ between profiling and
    // events dataset. For now, just drop everything except transaction
    const search = new MutableSearch('');
    const transaction = decodeScalar(location.query.transaction);

    if (defined(transaction)) {
      search.setFilterValues('transaction', [transaction]);
    }

    return search;
  });

  const profiles = useProfileEvents<ProfilingFieldType>({
    cursor: profilesCursor,
    fields,
    query: query.formatString(),
    sort,
    limit: 30,
    referrer: 'api.profiling.transactions-profiles-table',
  });

  const handleSearch: SmartSearchBarProps['onSearch'] = useCallback(
    (searchQuery: string) => {
      setQuery(new MutableSearch(searchQuery));
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

  const transaction = decodeScalar(location.query.transaction);

  return (
    <PageLayout
      location={location}
      organization={organization}
      projects={projects.projects}
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
              <SearchBar
                searchSource="transaction_profiles"
                organization={organization}
                projectIds={projects.projects.map(p => parseInt(p.id, 10))}
                query={query.formatString()}
                onSearch={handleSearch}
                maxQueryLength={MAX_QUERY_LENGTH}
              />
            </FilterActions>
            <ProfileEventsTable
              columns={fields}
              data={profiles.status === 'success' ? profiles.data : null}
              error={profiles.status === 'error' ? t('Unable to load profiles') : null}
              isLoading={profiles.status === 'loading'}
              sort={sort}
              sortableColumns={sortableFields}
            />
          </Layout.Main>
        );
      }}
    />
  );
}

function ProfilesWrapper() {
  const organization = useOrganization();
  const location = useLocation();
  const transaction = decodeScalar(location.query.transaction);

  if (!transaction) {
    redirectToPerformanceHomepage(organization, location);
    return null;
  }

  return <Profiles organization={organization} transaction={transaction} />;
}

interface ProfilesProps {
  organization: Organization;
  transaction: string;
}

function Profiles({organization, transaction}: ProfilesProps) {
  const location = useLocation();
  const projects = useProjects();

  const rawQuery = decodeScalar(location.query.query, '');

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

  return (
    <PageLayout
      location={location}
      organization={organization}
      projects={projects.projects}
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
              <SearchBar
                searchSource="transaction_profiles"
                organization={organization}
                projectIds={projects.projects.map(p => parseInt(p.id, 10))}
                query={rawQuery}
                onSearch={handleSearch}
                maxQueryLength={MAX_QUERY_LENGTH}
              />
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

  if (organization.features.includes('continuous-profiling-compat')) {
    return <ProfilesWrapper />;
  }

  return <ProfilesLegacy />;
}

export default ProfilesIndex;
