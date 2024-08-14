import styled from '@emotion/styled';

import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {ProjectPageFilter} from 'sentry/components/organizations/projectPageFilter';
import {space} from 'sentry/styles/space';
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
  display: flex;
  flex-basis: content;
  width: 100%;
  max-width: 43rem;
  align-self: flex-start;

  > div > button {
    width: 100%;
  }

  & > * {
    /* Prevent date filter from shrinking below 6.5rem */
    &:nth-last-child(2) {
      min-width: 6.5rem;
    }

    &:last-child {
      min-width: 0;
    }
  }
`;

export default IssueListFilters;
