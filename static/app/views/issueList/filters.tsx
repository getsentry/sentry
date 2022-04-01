import * as React from 'react';
import styled from '@emotion/styled';

import DatePageFilter from 'sentry/components/datePageFilter';
import EnvironmentPageFilter from 'sentry/components/environmentPageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import ProjectPageFilter from 'sentry/components/projectPageFilter';
import {tct} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization, SavedSearch} from 'sentry/types';

import IssueListSearchBar from './searchBar';
import IssueListSortOptions from './sortOptions';
import {TagValueLoader} from './types';

type IssueListSearchBarProps = React.ComponentProps<typeof IssueListSearchBar>;

type Props = {
  isSearchDisabled: boolean;
  onSearch: (query: string) => void;
  onSidebarToggle: (event: React.MouseEvent) => void;
  onSortChange: (sort: string) => void;
  organization: Organization;

  query: string;
  queryCount: number;
  savedSearch: SavedSearch;
  sort: string;
  tagValueLoader: TagValueLoader;
  tags: NonNullable<IssueListSearchBarProps['supportedTags']>;
};

function IssueListFilters({
  organization,
  savedSearch,
  query,
  queryCount,
  isSearchDisabled,
  sort,
  onSidebarToggle,
  onSearch,
  onSortChange,
  tagValueLoader,
  tags,
}: Props) {
  const hasPageFilters = organization.features.includes('selection-filters-v2');

  return (
    <FilterContainer>
      <SearchContainer hasPageFilters={hasPageFilters}>
        {hasPageFilters && (
          <PageFilterBar>
            <ProjectPageFilter />
            <EnvironmentPageFilter alignDropdown="left" />
            <DatePageFilter alignDropdown="left" />
          </PageFilterBar>
        )}
        <IssueListSearchBar
          organization={organization}
          query={query || ''}
          sort={sort}
          onSearch={onSearch}
          disabled={isSearchDisabled}
          excludeEnvironment
          supportedTags={tags}
          tagValueLoader={tagValueLoader}
          savedSearch={savedSearch}
          onSidebarToggle={onSidebarToggle}
        />
        {!hasPageFilters && (
          <DropdownsWrapper>
            <IssueListSortOptions sort={sort} query={query} onSelect={onSortChange} />
          </DropdownsWrapper>
        )}
      </SearchContainer>
      {hasPageFilters && (
        <ResultsRow>
          <QueryCount>
            {queryCount > 0 && tct('[queryCount] results found', {queryCount})}
          </QueryCount>
          <DisplayOptionsBar>
            <IssueListSortOptions
              sort={sort}
              query={query}
              onSelect={onSortChange}
              hasPageFilters
            />
          </DisplayOptionsBar>
        </ResultsRow>
      )}
    </FilterContainer>
  );
}

const FilterContainer = styled('div')`
  display: grid;
  gap: ${space(1)};
  margin-bottom: ${space(1)};
`;

const SearchContainer = styled('div')<{
  hasPageFilters?: boolean;
}>`
  display: inline-grid;
  gap: ${space(1)};
  width: 100%;
  margin-bottom: ${space(1)};

  ${p =>
    p.hasPageFilters
      ? `grid-template-columns: minmax(0, max-content) minmax(20rem, 1fr);`
      : `
    @media (min-width: ${p.theme.breakpoints[0]}) {
      grid-template-columns: 1fr auto;
    }
  }`}

  @media (max-width: ${p => p.theme.breakpoints[0]}) {
    grid-template-columns: minmax(0, 1fr);
  }
`;

const DropdownsWrapper = styled('div')`
  display: grid;
  gap: ${space(1)};
  grid-template-columns: 1fr;
  align-items: start;

  @media (max-width: ${p => p.theme.breakpoints[0]}) {
    grid-template-columns: 1fr;
  }
`;

const QueryCount = styled('p')`
  font-size: ${p => p.theme.fontSizeLarge};
  font-weight: 600;
  color: ${p => p.theme.headingColor};
  margin-bottom: 0;
`;

const DisplayOptionsBar = styled(PageFilterBar)`
  height: auto;

  /* make sure the border is on top of the trigger buttons */
  &::after {
    z-index: ${p => p.theme.zIndex.issuesList.displayOptions + 1};
  }

  button[aria-haspopup='listbox'] {
    font-weight: 600;
  }
`;

const ResultsRow = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

export default IssueListFilters;
