import {useEffect} from 'react';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';

import DatePageFilter from 'sentry/components/datePageFilter';
import EnvironmentPageFilter from 'sentry/components/environmentPageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import ProjectPageFilter from 'sentry/components/projectPageFilter';
import {space} from 'sentry/styles/space';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import ReplaySearchBar from 'sentry/views/replays/replaySearchBar';

const DEFAULT_QUERY = 'duration:>=5';

function ReplaysFilters() {
  const {selection} = usePageFilters();
  const {pathname, query} = useLocation();
  const organization = useOrganization();

  useEffect(() => {
    if (query.query === undefined) {
      // Set default query into url if there is no query set
      browserHistory.replace({
        pathname,
        query: {
          ...query,
          cursor: undefined,
          query: DEFAULT_QUERY,
        },
      });
    }
  });

  return (
    <FilterContainer>
      <PageFilterBar condensed>
        <ProjectPageFilter resetParamsOnChange={['cursor']} />
        <EnvironmentPageFilter resetParamsOnChange={['cursor']} />
        <DatePageFilter alignDropdown="left" resetParamsOnChange={['cursor']} />
      </PageFilterBar>
      <ReplaySearchBar
        organization={organization}
        pageFilters={selection}
        defaultQuery={DEFAULT_QUERY}
        query={decodeScalar(query.query, DEFAULT_QUERY)}
        onSearch={searchQuery => {
          browserHistory.push({
            pathname,
            query: {
              ...query,
              cursor: undefined,
              query: searchQuery.trim(),
            },
          });
        }}
      />
    </FilterContainer>
  );
}

const FilterContainer = styled('div')`
  display: inline-grid;
  grid-template-columns: minmax(0, max-content) minmax(20rem, 1fr);
  gap: ${space(2)};
  width: 100%;
  margin-bottom: ${space(2)};

  @media (max-width: ${p => p.theme.breakpoints.small}) {
    grid-template-columns: minmax(0, 1fr);
  }
`;

export default ReplaysFilters;
