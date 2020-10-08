import PropTypes from 'prop-types';
import React from 'react';
import styled from '@emotion/styled';

import {Organization, SavedSearch} from 'app/types';
import {PageHeader} from 'app/styles/organization';
import {trackAnalyticsEvent} from 'app/utils/analytics';
import {t} from 'app/locale';
import PageHeading from 'app/components/pageHeading';
import QueryCount from 'app/components/queryCount';

import IssueListSearchBar from './searchBar';
import IssueListSortOptions from './sortOptions';
import SavedSearchSelector from './savedSearchSelector';

const defaultProps = {
  sort: '',
  query: null as string | null,
  onSortChange: (() => {}) as (sort: string) => void,
  onSearch: (() => {}) as (query: string) => void,
  onSidebarToggle: (() => {}) as (event: React.MouseEvent) => void,
};

type Props = {
  organization: Organization;

  onSavedSearchSelect: (search: SavedSearch) => void;
  onSavedSearchDelete: (search: SavedSearch) => void;
  tagValueLoader: React.ComponentProps<typeof IssueListSearchBar>['tagValueLoader'];
  tags: NonNullable<React.ComponentProps<typeof IssueListSearchBar>['supportedTags']>;

  savedSearchList?: SavedSearch[];
  savedSearch?: SavedSearch;

  isSearchDisabled?: boolean;
  queryCount?: number;
  queryMaxCount?: number;
} & typeof defaultProps;

class IssueListFilters extends React.Component<Props> {
  static contextTypes = {
    location: PropTypes.object,
  };

  static defaultProps = defaultProps;

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
    } = this.props;

    return (
      <PageHeader>
        <PageHeading>
          {t('Issues')}
          <QueryCount count={queryCount} max={queryMaxCount} />
        </PageHeading>

        <SearchContainer isWide>
          <IssueListSortOptions sort={sort} onSelect={onSortChange} />

          <SavedSearchSelector
            key={query}
            organization={organization}
            savedSearchList={savedSearchList}
            onSavedSearchSelect={this.handleSavedSearchSelect}
            onSavedSearchDelete={onSavedSearchDelete}
            query={query}
          />

          <IssueListSearchBar
            organization={organization}
            query={query || ''}
            onSearch={onSearch}
            disabled={isSearchDisabled}
            excludeEnvironment
            supportedTags={tags}
            tagValueLoader={tagValueLoader}
            savedSearch={savedSearch}
            onSidebarToggle={onSidebarToggle}
          />
        </SearchContainer>
      </PageHeader>
    );
  }
}

const SearchContainer = styled('div')<{isWide: boolean}>`
  display: flex;
  width: ${p => (p.isWide ? '70%' : '58.3%')};
`;

export default IssueListFilters;
