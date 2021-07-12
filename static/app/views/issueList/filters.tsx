import * as React from 'react';
import {ClassNames} from '@emotion/react';
import styled from '@emotion/styled';

import Feature from 'app/components/acl/feature';
import GuideAnchor from 'app/components/assistant/guideAnchor';
import ButtonBar from 'app/components/buttonBar';
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
          <ButtonBar gap={1}>
            <Feature features={['issue-percent-display']} organization={organization}>
              <IssueListDisplayOptions
                onDisplayChange={onDisplayChange}
                display={display}
                hasSessions={hasSessions}
                hasMultipleProjectsSelected={selectedProjects.length !== 1}
              />
            </Feature>
            <IssueListSortOptions sort={sort} query={query} onSelect={onSortChange} />
          </ButtonBar>
        </SearchContainer>
      </PageHeader>
    );
  }
}

const SearchContainer = styled('div')`
  display: grid;
  grid-template-columns: 1fr max-content;
  grid-gap: ${space(1)};
  align-items: start;
  width: 100%;
`;

export default IssueListFilters;
