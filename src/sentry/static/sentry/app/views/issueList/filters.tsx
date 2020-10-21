import PropTypes from 'prop-types';
import * as React from 'react';
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
