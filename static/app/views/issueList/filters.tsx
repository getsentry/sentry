import * as React from 'react';
import styled from '@emotion/styled';

import DatePageFilter from 'sentry/components/datePageFilter';
import EnvironmentPageFilter from 'sentry/components/environmentPageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import ProjectPageFilter from 'sentry/components/projectPageFilter';
import {tct} from 'sentry/locale';
import ProjectsStore from 'sentry/stores/projectsStore';
import space from 'sentry/styles/space';
import {Organization, SavedSearch} from 'sentry/types';

import IssueListDisplayOptions from './displayOptions';
import IssueListSearchBar from './searchBar';
import IssueListSortOptions from './sortOptions';
import {TagValueLoader} from './types';
import {IssueDisplayOptions} from './utils';

type IssueListSearchBarProps = React.ComponentProps<typeof IssueListSearchBar>;

type Props = {
  display: IssueDisplayOptions;
  isSearchDisabled: boolean;
  onDisplayChange: (display: string) => void;
  onSearch: (query: string) => void;
  onSidebarToggle: (event: React.MouseEvent) => void;
  onSortChange: (sort: string) => void;
  organization: Organization;

  query: string;
  queryCount: number;
  savedSearch: SavedSearch;
  selectedProjects: number[];
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
  display,
  selectedProjects,
  onSidebarToggle,
  onSearch,
  onSortChange,
  onDisplayChange,
  tagValueLoader,
  tags,
}: Props) {
  const hasIssuePercentDisplay = organization.features.includes('issue-percent-display');
  const hasMultipleProjectsSelected =
    !selectedProjects || selectedProjects.length !== 1 || selectedProjects[0] === -1;
  const hasSessions =
    !hasMultipleProjectsSelected &&
    (ProjectsStore.getById(`${selectedProjects[0]}`)?.hasSessions ?? false);
  const hasPageFilters = organization.features.includes('selection-filters-v2');

  return (
    <FilterContainer>
      <SearchContainer
        hasPageFilters={hasPageFilters}
        hasIssuePercentDisplay={hasIssuePercentDisplay}
      >
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

        {hasPageFilters ? (
          <PageFilterBar>
            <ProjectPageFilter />
            <EnvironmentPageFilter alignDropdown="right" />
            <DatePageFilter alignDropdown="right" />
          </PageFilterBar>
        ) : (
          <DropdownsWrapper hasIssuePercentDisplay={hasIssuePercentDisplay}>
            {hasIssuePercentDisplay && (
              <IssueListDisplayOptions
                onDisplayChange={onDisplayChange}
                display={display}
                hasMultipleProjectsSelected={hasMultipleProjectsSelected}
                hasSessions={hasSessions}
              />
            )}
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
            {hasIssuePercentDisplay && (
              <IssueListDisplayOptions
                onDisplayChange={onDisplayChange}
                display={display}
                hasMultipleProjectsSelected={hasMultipleProjectsSelected}
                hasSessions={hasSessions}
                hasPageFilters
              />
            )}
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
  hasIssuePercentDisplay?: boolean;
  hasPageFilters?: boolean;
}>`
  display: inline-grid;
  gap: ${space(1)};
  width: 100%;
  margin-bottom: ${space(1)};

  ${p =>
    p.hasPageFilters
      ? `
    grid-template-columns: 1fr 32rem;

    @media (max-width: ${p.theme.breakpoints[2]}) {
      grid-template-columns: 1fr 28rem;
    }

    @media (max-width: ${p.theme.breakpoints[1]}) {
      grid-template-columns: 1fr 24rem;
    }

  `
      : `
    @media (min-width: ${p.theme.breakpoints[p.hasIssuePercentDisplay ? 1 : 0]}) {
      grid-template-columns: 1fr auto;
    }
  }`}

  @media (max-width: ${p => p.theme.breakpoints[0]}) {
    grid-template-columns: minmax(0, 1fr);
  }
`;

const DropdownsWrapper = styled('div')<{hasIssuePercentDisplay?: boolean}>`
  display: grid;
  gap: ${space(1)};
  grid-template-columns: 1fr ${p => (p.hasIssuePercentDisplay ? '1fr' : '')};
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
