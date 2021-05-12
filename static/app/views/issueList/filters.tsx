import * as React from 'react';
import {ClassNames} from '@emotion/react';
import styled from '@emotion/styled';

import GuideAnchor from 'app/components/assistant/guideAnchor';
import {PageHeader} from 'app/styles/organization';
import space from 'app/styles/space';
import {Organization, SavedSearch} from 'app/types';

import IssueListSearchBar from './searchBar';
import IssueListSortOptions from './sortOptions';
import {TagValueLoader} from './types';

type IssueListSearchBarProps = React.ComponentProps<typeof IssueListSearchBar>;

type Props = {
  organization: Organization;
  savedSearch: SavedSearch;
  sort: string;
  query: string;
  isSearchDisabled: boolean;

  onSortChange: (sort: string) => void;
  onSearch: (query: string) => void;
  onSidebarToggle: (event: React.MouseEvent) => void;
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
  onSortChange,
  tagValueLoader,
  tags,
}: Props) {
  const isAssignedQuery = /\bassigned:/.test(query);

  return (
    <PageHeader>
      <SearchContainer>
        <SearchSelectorContainer>
          <ClassNames>
            {({css}) => (
              <GuideAnchor
                target="assigned_or_suggested_query"
                disabled={!isAssignedQuery}
                containerClassName={css`
                  width: 100%;
                `}
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
              </GuideAnchor>
            )}
          </ClassNames>
        </SearchSelectorContainer>

        <IssueListSortOptions sort={sort} query={query} onSelect={onSortChange} />
      </SearchContainer>
    </PageHeader>
  );
}

const SearchContainer = styled('div')`
  display: flex;
  width: 100%;
`;

const SearchSelectorContainer = styled('div')`
  display: flex;
  flex-grow: 1;

  margin-right: ${space(1)};
  margin-left: 0;
`;

export default IssueListFilters;
