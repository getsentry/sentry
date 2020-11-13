import PropTypes from 'prop-types';
import React from 'react';
import styled from '@emotion/styled';

import {Organization, SavedSearch} from 'app/types';
import {PageHeader} from 'app/styles/organization';
import {trackAnalyticsEvent} from 'app/utils/analytics';
import {t} from 'app/locale';
import PageHeading from 'app/components/pageHeading';
import QueryCount from 'app/components/queryCount';
import Feature from 'app/components/acl/feature';
import space from 'app/styles/space';

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
      <Feature features={['organizations:inbox']}>
        {({hasFeature}) => (
          <PageHeader>
            {!hasFeature && (
              <PageHeading>
                {t('Issues')}
                <QueryCount count={queryCount} max={queryMaxCount} />
              </PageHeading>
            )}

            <SearchContainer isInbox={hasFeature}>
              <IssueListSortOptions sort={sort} onSelect={onSortChange} />

              <SearchSelectorContainer isInbox={hasFeature}>
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
              </SearchSelectorContainer>
            </SearchContainer>
          </PageHeader>
        )}
      </Feature>
    );
  }
}

const SearchContainer = styled('div')<{isInbox: boolean}>`
  display: flex;
  width: ${p => (p.isInbox ? '100%' : '70%')};
  flex-direction: ${p => (p.isInbox ? 'row-reverse' : 'row')};
`;

const SearchSelectorContainer = styled('div')<{isInbox: boolean}>`
  display: flex;
  flex-grow: 1;

  margin-right: ${p => (p.isInbox ? space(1) : 0)};
  margin-left: ${p => (p.isInbox ? 0 : space(1))};
`;

export default IssueListFilters;
