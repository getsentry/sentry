import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import {PageHeader} from 'app/styles/organization';
import {analytics} from 'app/utils/analytics';
import {t} from 'app/locale';
import PageHeading from 'app/components/pageHeading';
import QueryCount from 'app/components/queryCount';
import SentryTypes from 'app/sentryTypes';

import SavedSearchSelector from './savedSearchSelector';
import IssueListSearchBar from './searchBar';
import IssueListSortOptions from './sortOptions';

class IssueListFilters extends React.Component {
  static propTypes = {
    organization: SentryTypes.Organization,

    savedSearchList: PropTypes.arrayOf(SentryTypes.SavedSearch),
    savedSearch: SentryTypes.SavedSearch,

    sort: PropTypes.string,
    query: PropTypes.string,
    isSearchDisabled: PropTypes.bool,
    queryCount: PropTypes.number,
    queryMaxCount: PropTypes.number,

    onSortChange: PropTypes.func,
    onSearch: PropTypes.func,
    onSidebarToggle: PropTypes.func,
    onSavedSearchSelect: PropTypes.func.isRequired,
    onSavedSearchDelete: PropTypes.func.isRequired,
    tagValueLoader: PropTypes.func.isRequired,
    tags: PropTypes.object.isRequired,
  };

  static contextTypes = {
    location: PropTypes.object,
  };

  static defaultProps = {
    sort: '',
    query: null,
    onSortChange: function() {},
    onSearch: function() {},
    onSidebarToggle: function() {},
  };

  handleSavedSearchSelect = savedSearch => {
    analytics('organization_saved_search.selected', {
      org_id: this.props.organization.id,
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

const SearchContainer = styled('div')`
  display: flex;
  width: ${p => (p.isWide ? '70%' : '58.3%')};
`;

export default IssueListFilters;
