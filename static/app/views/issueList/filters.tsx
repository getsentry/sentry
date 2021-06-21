import * as React from 'react';
import {ClassNames} from '@emotion/react';
import styled from '@emotion/styled';

import Feature from 'app/components/acl/feature';
import GuideAnchor from 'app/components/assistant/guideAnchor';
import {PageHeader} from 'app/styles/organization';
import space from 'app/styles/space';
import {Organization, SavedSearch} from 'app/types';

import IssueListDisplayOptions from './displayOptions';
import IssueListSearchBar from './searchBar';
import IssueListSortOptions from './sortOptions';
import {TagValueLoader} from './types';
import {IssueDisplayOptions} from './utils';

type IssueListSearchBarProps = React.ComponentProps<typeof IssueListSearchBar>;

type Props = {
  organization: Organization;
  savedSearch: SavedSearch;
  display: IssueDisplayOptions;
  sort: string;
  query: string;
  isSearchDisabled: boolean;
  hasSessions: boolean;
  selectedProjects: number[];

  onDisplayChange: (display: string) => void;
  onSortChange: (sort: string) => void;
  onSearch: (query: string) => void;
  onSidebarToggle: (event: React.MouseEvent) => void;
  tagValueLoader: TagValueLoader;
  tags: NonNullable<IssueListSearchBarProps['supportedTags']>;
};

class IssueListFilters extends React.Component<Props> {
  render() {
    const {
      organization,
      savedSearch,
      query,
      isSearchDisabled,
      sort,
      display,
      hasSessions,
      selectedProjects,

      onSidebarToggle,
      onSearch,
      onSortChange,
      onDisplayChange,
      tagValueLoader,
      tags,
    } = this.props;
    const isAssignedQuery = /\bassigned:/.test(query);

    return (
      <PageHeader>
        <SearchContainer>
          <IssueListSortOptions sort={sort} query={query} onSelect={onSortChange} />
          <Feature features={['issue-percent-display']} organization={organization}>
            <IssueListDisplayOptions
              onDisplayChange={onDisplayChange}
              display={display}
              hasSessions={hasSessions}
              hasMultipleProjectsSelected={selectedProjects.length !== 1}
            />
          </Feature>

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
        </SearchContainer>
      </PageHeader>
    );
  }
}

const SearchContainer = styled('div')<{isInbox?: boolean}>`
  display: flex;
  width: ${p => (p.isInbox ? '100%' : '70%')};
  flex-direction: ${p => (p.isInbox ? 'row-reverse' : 'row')};
  align-items: flex-start;
`;

const SearchSelectorContainer = styled('div')<{isInbox?: boolean}>`
  display: flex;
  flex-grow: 1;

  margin-right: ${p => (p.isInbox ? space(1) : 0)};
  margin-left: ${p => (p.isInbox ? 0 : space(1))};
`;

export default IssueListFilters;
