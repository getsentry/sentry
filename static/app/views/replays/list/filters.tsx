import {browserHistory} from 'react-router';
import styled from '@emotion/styled';

import DatePageFilter from 'sentry/components/datePageFilter';
import EnvironmentPageFilter from 'sentry/components/environmentPageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import ProjectPageFilter from 'sentry/components/projectPageFilter';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import ReplaySearchBar from 'sentry/views/replays/list/replaySearchBar';

export function ReplaysFilters() {
  return (
    <Container>
      <PageFilterBar condensed>
        <ProjectPageFilter resetParamsOnChange={['cursor']} />
        <EnvironmentPageFilter resetParamsOnChange={['cursor']} />
        <DatePageFilter alignDropdown="left" resetParamsOnChange={['cursor']} />
      </PageFilterBar>
    </Container>
  );
}

export function ReplaysSearch() {
  const {selection} = usePageFilters();
  const {pathname, query} = useLocation();
  const organization = useOrganization();

  return (
    <Container>
      <ReplaySearchBar
        organization={organization}
        pageFilters={selection}
        defaultQuery=""
        query={decodeScalar(query.query, '')}
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
    </Container>
  );
}

const Container = styled('div')`
  display: inline-grid;
  width: 100%;
`;
