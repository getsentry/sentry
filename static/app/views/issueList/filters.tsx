import styled from '@emotion/styled';

import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {ProjectPageFilter} from 'sentry/components/organizations/projectPageFilter';
import {space} from 'sentry/styles/space';
import useOrganization from 'sentry/utils/useOrganization';
import IssueListSortOptions from 'sentry/views/issueList/actions/sortOptions';
import {IssueSearchWithSavedSearches} from 'sentry/views/issueList/issueSearchWithSavedSearches';

interface Props {
  onSearch: (query: string) => void;
  onSortChange: (sort: string) => void;
  query: string;
  sort: string;
}

function IssueListFilters({query, sort, onSortChange, onSearch}: Props) {
  const organization = useOrganization();

  return (
    <SearchContainer>
      <StyledPageFilterBar>
        <ProjectPageFilter />
        <EnvironmentPageFilter />
        <DatePageFilter />
      </StyledPageFilterBar>

      <IssueSearchWithSavedSearches {...{query, onSearch}} />

      {organization.features.includes('issue-stream-table-layout') && (
        <IssueListSortOptions
          query={query}
          sort={sort}
          onSelect={onSortChange}
          triggerSize="md"
          showIcon={false}
        />
      )}
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
`;

export default IssueListFilters;
