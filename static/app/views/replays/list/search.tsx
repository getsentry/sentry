import styled from '@emotion/styled';

import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import ReplaySearchBar from 'sentry/views/replays/list/replaySearchBar';

export default function ReplaysSearch() {
  const {selection} = usePageFilters();
  const {pathname, query} = useLocation();
  const organization = useOrganization();

  const navigate = useNavigate();

  return (
    <SearchContainer>
      <ReplaySearchBar
        organization={organization}
        pageFilters={selection}
        defaultQuery=""
        query={decodeScalar(query.query, '')}
        onSearch={searchQuery => {
          navigate({
            pathname,
            query: {
              ...query,
              cursor: undefined,
              query: searchQuery.trim(),
            },
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
