import {Fragment} from 'react';
import styled from '@emotion/styled';

import DatePageFilter from 'sentry/components/datePageFilter';
import EnvironmentPageFilter from 'sentry/components/environmentPageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import ProjectPageFilter from 'sentry/components/projectPageFilter';
import space from 'sentry/styles/space';
import {Organization, SavedSearch} from 'sentry/types';

import IssueListSearchBar from './searchBar';
import {TagValueLoader} from './types';

type IssueListSearchBarProps = React.ComponentProps<typeof IssueListSearchBar>;

type Props = {
  isSearchDisabled: boolean;
  onSearch: (query: string) => void;
  onSidebarToggle: (event: React.MouseEvent) => void;
  organization: Organization;
  query: string;
  savedSearch: SavedSearch;
  sort: string;
  tagValueLoader: TagValueLoader;
  tags: NonNullable<IssueListSearchBarProps['supportedTags']>;
};

function IssueListFilters({
  organization,
  savedSearch,
  query,
  isSearchDisabled,
  sort,
  onSidebarToggle,
  onSearch,
  tagValueLoader,
  tags,
}: Props) {
  return (
    <Fragment>
      <SearchContainer>
        <PageFilterBar>
          <ProjectPageFilter />
          <EnvironmentPageFilter />
          <DatePageFilter alignDropdown="left" />
        </PageFilterBar>
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
      </SearchContainer>
    </Fragment>
  );
}

const SearchContainer = styled('div')`
  display: grid;
  gap: ${space(2)};
  width: 100%;
  margin-bottom: ${space(2)};
  grid-template-columns: minmax(0, max-content) minmax(20rem, 1fr);

  @media (max-width: ${p => p.theme.breakpoints.small}) {
    grid-template-columns: minmax(0, 1fr);
  }
`;

export default IssueListFilters;
