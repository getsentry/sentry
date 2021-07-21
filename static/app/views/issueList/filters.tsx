import * as React from 'react';
import {ClassNames} from '@emotion/react';
import styled from '@emotion/styled';

import GuideAnchor from 'app/components/assistant/guideAnchor';
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
    const hasIssuePercentDisplay = organization.features.includes(
      'issue-percent-display'
    );

    return (
      <SearchContainer hasIssuePercentDisplay={hasIssuePercentDisplay}>
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

        <DropdownsWrapper hasIssuePercentDisplay={hasIssuePercentDisplay}>
          {hasIssuePercentDisplay && (
            <IssueListDisplayOptions
              onDisplayChange={onDisplayChange}
              display={display}
              hasSessions={hasSessions}
              hasMultipleProjectsSelected={
                selectedProjects.length !== 1 || selectedProjects[0] === -1
              }
            />
          )}
          <IssueListSortOptions sort={sort} query={query} onSelect={onSortChange} />
        </DropdownsWrapper>
      </SearchContainer>
    );
  }
}

const SearchContainer = styled('div')<{hasIssuePercentDisplay?: boolean}>`
  display: inline-grid;
  grid-gap: ${space(1)};
  margin-bottom: ${space(2)};
  width: 100%;

  @media (min-width: ${p => p.theme.breakpoints[p.hasIssuePercentDisplay ? 1 : 0]}) {
    grid-template-columns: 1fr auto;
  }

  @media (max-width: ${p => p.theme.breakpoints[0]}) {
    grid-template-columns: 1fr;
  }
`;

const DropdownsWrapper = styled('div')<{hasIssuePercentDisplay?: boolean}>`
  display: grid;
  grid-gap: ${space(1)};
  grid-template-columns: 1fr ${p => (p.hasIssuePercentDisplay ? '1fr' : '')};

  @media (max-width: ${p => p.theme.breakpoints[0]}) {
    grid-template-columns: 1fr;
  }
`;

export default IssueListFilters;
