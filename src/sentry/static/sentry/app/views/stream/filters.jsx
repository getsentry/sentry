import React from 'react';

import SavedSearchSelector from './savedSearchSelector';
import SearchBar from './searchBar';
import SortOptions from './sortOptions';
import {t} from '../../locale';

const StreamFilters = React.createClass({
  propTypes: {
    orgId: React.PropTypes.string.isRequired,
    projectId: React.PropTypes.string.isRequired,
    access: React.PropTypes.object.isRequired,
    tags: React.PropTypes.object.isRequired,

    searchId: React.PropTypes.string,
    savedSearchList: React.PropTypes.array.isRequired,

    defaultQuery: React.PropTypes.string,
    sort: React.PropTypes.string,
    filter: React.PropTypes.string,
    query: React.PropTypes.string,
    isSearchDisabled: React.PropTypes.bool,
    queryCount: React.PropTypes.number,
    queryMaxCount: React.PropTypes.number,

    onSortChange: React.PropTypes.func,
    onSearch: React.PropTypes.func,
    onSidebarToggle: React.PropTypes.func,
    onSavedSearchCreate: React.PropTypes.func.isRequired
  },

  contextTypes: {
    location: React.PropTypes.object
  },

  getDefaultProps() {
    return {
      defaultQuery: '',
      sort: '',
      filter: '',
      query: null,
      onSortChange: function() {},
      onSearch: function() {},
      onSidebarToggle: function() {}
    };
  },

  render() {
    let {
      access,
      orgId,
      projectId,
      searchId,
      queryCount,
      queryMaxCount,
      query,
      savedSearchList,
      tags,
      defaultQuery,
      isSearchDisabled,
      sort,

      onSidebarToggle,
      onSearch,
      onSavedSearchCreate,
      onSortChange
    } = this.props;

    return (
      <div className="stream-header">
        <div className="row">
          <div className="col-sm-5">
            <SavedSearchSelector
              access={access}
              orgId={orgId}
              projectId={projectId}
              searchId={searchId}
              queryCount={queryCount}
              queryMaxCount={queryMaxCount}
              query={query}
              onSavedSearchCreate={onSavedSearchCreate}
              savedSearchList={savedSearchList}
            />
          </div>
          <div className="col-sm-7">
            <div className="search-container">
              <div className="stream-sort">
                <SortOptions sort={sort} onSelect={onSortChange} />
              </div>

              <SearchBar
                orgId={orgId}
                projectId={projectId}
                ref="searchBar"
                tags={tags}
                defaultQuery={defaultQuery || ''}
                placeholder={t('Search for events, users, tags, and everything else.')}
                query={query || ''}
                onSearch={onSearch}
                disabled={isSearchDisabled}
              />
              <a
                className="btn btn-default toggle-stream-sidebar"
                onClick={onSidebarToggle}>
                <span className="icon-filter" />
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }
});

export default StreamFilters;
