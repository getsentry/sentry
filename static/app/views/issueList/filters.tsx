import styled from '@emotion/styled';

import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {ProjectPageFilter} from 'sentry/components/organizations/projectPageFilter';
import {space} from 'sentry/styles/space';
import IssueListSortOptions from 'sentry/views/issueList/actions/sortOptions';
import {IssueSearch} from 'sentry/views/issueList/issueSearch';
import {IssueViewSaveButton} from 'sentry/views/issueList/issueViews/issueViewSaveButton';
import type {IssueSortOptions} from 'sentry/views/issueList/utils';

interface Props {
  onSearch: (query: string) => void;
  onSortChange: (sort: string) => void;
  query: string;
  sort: IssueSortOptions;
}

function IssueListFilters({query, sort, onSortChange, onSearch}: Props) {
  return (
    <FiltersContainer>
      <StyledPageFilterBar>
        <ProjectPageFilter />
        <EnvironmentPageFilter />
        <DatePageFilter />
      </StyledPageFilterBar>

      <Search {...{query, onSearch}} />

      <SortSaveContainer>
        <IssueListSortOptions
          query={query}
          sort={sort}
          onSelect={onSortChange}
          triggerSize="md"
          showIcon={false}
        />

        <IssueViewSaveButton query={query} sort={sort} />
      </SortSaveContainer>
    </FiltersContainer>
  );
}

const FiltersContainer = styled('div')`
  display: grid;
  column-gap: ${space(1)};
  row-gap: ${space(1)};
  margin-bottom: ${space(2)};
  width: 100%;

  grid-template-columns: 100%;
  grid-template-areas:
    'page-filters'
    'search'
    'sort-save';

  @media (min-width: ${p => p.theme.breakpoints.xs}) {
    grid-template-columns: 1fr auto;
    grid-template-areas:
      'page-filters sort-save'
      'search search';
  }

  @media (min-width: ${p => p.theme.breakpoints.xl}) {
    grid-template-columns: auto 1fr auto;
    grid-template-areas: 'page-filters search sort-save';
  }
`;

const Search = styled(IssueSearch)`
  grid-area: search;
`;

const StyledPageFilterBar = styled(PageFilterBar)`
  grid-area: page-filters;
  display: flex;
  flex-basis: content;
  max-width: 100%;
  justify-self: start;

  > div > button {
    width: 100%;
  }
`;

const SortSaveContainer = styled('div')`
  display: flex;
  align-items: start;
  gap: ${space(1)};
  grid-area: sort-save;

  justify-self: end;
`;

export default IssueListFilters;
