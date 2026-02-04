import styled from '@emotion/styled';
import {parseAsString, useQueryStates} from 'nuqs';

import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import ReplaySearchBar from 'sentry/views/replays/list/replaySearchBar';

export default function ReplaysSearch() {
  const {selection} = usePageFilters();
  const organization = useOrganization();

  const [{query}, setQueryParams] = useQueryStates({
    query: parseAsString.withDefault(''),
    cursor: parseAsString,
  });

  return (
    <SearchContainer>
      <ReplaySearchBar
        organization={organization}
        pageFilters={selection}
        initialQuery=""
        query={query}
        onSearch={searchQuery => {
          setQueryParams({
            query: searchQuery.trim() || null,
            cursor: null,
          });
        }}
      />
    </SearchContainer>
  );
}

const SearchContainer = styled('div')`
  flex: 1;
  min-width: 400px;
  max-width: 100%;
  width: auto;

  @media (max-width: ${p => p.theme.breakpoints.sm}) {
    min-width: auto;
  }
`;
