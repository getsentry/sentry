import {useCallback, useMemo, useState} from 'react';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';

import * as Layout from 'sentry/components/layouts/thirds';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {ProfileEventsTable} from 'sentry/components/profiling/profileEventsTable';
import SmartSearchBar, {SmartSearchBarProps} from 'sentry/components/smartSearchBar';
import {MAX_QUERY_LENGTH} from 'sentry/constants';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {defined} from 'sentry/utils';
import EventView from 'sentry/utils/discover/eventView';
import {useProfileEvents} from 'sentry/utils/profiling/hooks/useProfileEvents';
import {useProfileFilters} from 'sentry/utils/profiling/hooks/useProfileFilters';
import {formatSort} from 'sentry/utils/profiling/hooks/utils';
import {decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';
import Tab from 'sentry/views/performance/transactionSummary/tabs';
import {
  getProfilesTableFields,
  ProfilingFieldType,
} from 'sentry/views/profiling/profileSummary/content';

import PageLayout from '../pageLayout';

function Profiles(): React.ReactElement {
  const location = useLocation();
  const organization = useOrganization();
  const projects = useProjects();
  const {selection} = usePageFilters();

  const profilesCursor = useMemo(
    () => decodeScalar(location.query.cursor),
    [location.query.cursor]
  );

  const project = projects.projects.find(p => p.id === location.query.project);
  const fields = getProfilesTableFields(project?.platform);

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

  const profileFilters = useProfileFilters({query: '', selection});
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
              <SmartSearchBar
                organization={organization}
                hasRecentSearches
                searchSource="profile_landing"
                supportedTags={profileFilters}
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
            />
          </Layout.Main>
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

export default Profiles;
