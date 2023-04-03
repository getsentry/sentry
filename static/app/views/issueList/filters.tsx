import styled from '@emotion/styled';

import DatePageFilter from 'sentry/components/datePageFilter';
import EnvironmentPageFilter from 'sentry/components/environmentPageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import ProjectPageFilter from 'sentry/components/projectPageFilter';
import {space} from 'sentry/styles/space';
import IssueCategoryFilter from 'sentry/views/issueList/issueCategoryFilter';
import {IssueSearchWithSavedSearches} from 'sentry/views/issueList/issueSearchWithSavedSearches';

interface Props {
  onSearch: (query: string) => void;
  query: string;
}

function IssueListFilters({query, onSearch}: Props) {
  return (
    <SearchContainer>
      <StyledPageFilterBar>
        <ProjectPageFilter />
        <EnvironmentPageFilter />
        <DatePageFilter />
        <IssueCategoryFilter query={query} onSearch={onSearch} />
      </StyledPageFilterBar>

      <IssueSearchWithSavedSearches {...{query, onSearch}} />
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
  width: 100%;
  max-width: 43rem;
`;

export default IssueListFilters;
