import {parseAsString, useQueryStates} from 'nuqs';

import {Container} from '@sentry/scraps/layout';

import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {useOrganization} from 'sentry/utils/useOrganization';
import {ReplaySearchBar} from 'sentry/views/explore/replays/list/replaySearchBar';

export function ReplaysSearch() {
  const {selection} = usePageFilters();
  const organization = useOrganization();

  const [{query}, setQueryParams] = useQueryStates({
    query: parseAsString.withDefault(''),
    cursor: parseAsString,
  });

  return (
    <Container
      flex="1"
      minWidth={{zero: 'auto', xl: '267px'}}
      maxWidth="100%"
      width="auto"
    >
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
    </Container>
  );
}
