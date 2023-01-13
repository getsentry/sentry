import styled from '@emotion/styled';

import DatePageFilter from 'sentry/components/datePageFilter';
import EnvironmentPageFilter from 'sentry/components/environmentPageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import ProjectPageFilter from 'sentry/components/projectPageFilter';
import space from 'sentry/styles/space';
import type {Organization} from 'sentry/types';

import IssueListSearchBar from './searchBar';

interface Props {
  onSearch: (query: string) => void;
  organization: Organization;
  query: string;
}

function IssueListFilters({organization, query, onSearch}: Props) {
  return (
    <SearchContainer>
      <StyledPageFilterBar>
        <ProjectPageFilter />
        <EnvironmentPageFilter />
        <DatePageFilter alignDropdown="left" />
      </StyledPageFilterBar>
      <StyledIssueListSearchBar
        searchSource="main_search"
        organization={organization}
        query={query || ''}
        onSearch={onSearch}
        excludedTags={['environment']}
      />
    </SearchContainer>
  );
}

const SearchContainer = styled('div')`
  display: flex;
  flex-wrap: wrap;
  column-gap: ${space(2)};
  row-gap: ${space(1)};
  width: 100%;
  margin-bottom: ${space(2)};

  @media (max-width: ${p => p.theme.breakpoints.small}) {
    flex-direction: column;
  }
`;

const StyledPageFilterBar = styled(PageFilterBar)`
  flex: 0 1 0;
  width: 100%;
  max-width: 30rem;
`;

const StyledIssueListSearchBar = styled(IssueListSearchBar)`
  flex: 1;
  width: 100%;

  @media (min-width: ${p => p.theme.breakpoints.small}) {
    min-width: 20rem;
  }

  @media (min-width: ${p => p.theme.breakpoints.large}) {
    min-width: 30rem;
  }
`;

export default IssueListFilters;
