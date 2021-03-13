import React from 'react';
import {ClassNames} from '@emotion/core';
import styled from '@emotion/styled';
import PropTypes from 'prop-types';

import GuideAnchor from 'app/components/assistant/guideAnchor';
import PageHeading from 'app/components/pageHeading';
import QueryCount from 'app/components/queryCount';
import {t} from 'app/locale';
import {PageHeader} from 'app/styles/organization';
import space from 'app/styles/space';
import {Organization, SavedSearch} from 'app/types';
import {trackAnalyticsEvent} from 'app/utils/analytics';

import SavedSearchSelector from './savedSearchSelector';
import IssueListSearchBar from './searchBar';
import IssueListSortOptions from './sortOptions';
import {TagValueLoader} from './types';

type IssueListSearchBarProps = React.ComponentProps<typeof IssueListSearchBar>;

type Props = {
  organization: Organization;
  savedSearchList: SavedSearch[];
  savedSearch: SavedSearch;
  sort: string;
  query: string;
  isSearchDisabled: boolean;
  queryCount: number;
  queryMaxCount: number;

  onSortChange: (sort: string) => void;
  onSearch: (query: string) => void;
  onSidebarToggle: (event: React.MouseEvent) => void;
  onSavedSearchSelect: (search: SavedSearch) => void;
  onSavedSearchDelete: (search: SavedSearch) => void;
  tagValueLoader: TagValueLoader;
  tags: NonNullable<IssueListSearchBarProps['supportedTags']>;
  isInbox?: boolean;
};

class IssueListFilters extends React.Component<Props> {
  static contextTypes = {
    location: PropTypes.object,
  };

  handleSavedSearchSelect = (savedSearch: SavedSearch) => {
    trackAnalyticsEvent({
      eventKey: 'organization_saved_search.selected',
      eventName: 'Organization Saved Search: Selected saved search',
      organization_id: this.props.organization.id,
      query: savedSearch.query,
      search_type: 'issues',
      id: savedSearch.id ? parseInt(savedSearch.id, 10) : -1,
    });

    if (this.props.onSavedSearchSelect) {
      this.props.onSavedSearchSelect(savedSearch);
    }
  };

  render() {
    const {
      organization,
      savedSearch,
      queryCount,
      queryMaxCount,
      query,
      savedSearchList,
      isSearchDisabled,
      sort,

      onSidebarToggle,
      onSearch,
      onSavedSearchDelete,
      onSortChange,
      tagValueLoader,
      tags,
      isInbox,
    } = this.props;
    const isAssignedQuery = /\bassigned:/.test(query);

    return (
      <PageHeader>
        {!isInbox && (
          <PageHeading>
            {t('Issues')} <QueryCount count={queryCount} max={queryMaxCount} />
          </PageHeading>
        )}

        <SearchContainer isInbox={isInbox}>
          <IssueListSortOptions sort={sort} query={query} onSelect={onSortChange} />

          <SearchSelectorContainer isInbox={isInbox}>
            {!isInbox && (
              <SavedSearchSelector
                key={query}
                organization={organization}
                savedSearchList={savedSearchList}
                onSavedSearchSelect={this.handleSavedSearchSelect}
                onSavedSearchDelete={onSavedSearchDelete}
                query={query}
                sort={sort}
              />
            )}

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
                    isInbox={isInbox}
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
`;

const SearchSelectorContainer = styled('div')<{isInbox?: boolean}>`
  display: flex;
  flex-grow: 1;

  margin-right: ${p => (p.isInbox ? space(1) : 0)};
  margin-left: ${p => (p.isInbox ? 0 : space(1))};
`;

export default IssueListFilters;
