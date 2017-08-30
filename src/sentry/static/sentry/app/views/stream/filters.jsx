import PropTypes from 'prop-types';
import React from 'react';

import SavedSearchSelector from './savedSearchSelector';
import SearchBar from './searchBar';
import SortOptions from './sortOptions';
import {t} from '../../locale';

const StreamFilters = React.createClass({
  propTypes: {
    orgId: PropTypes.string.isRequired,
    projectId: PropTypes.string.isRequired,
    access: PropTypes.object.isRequired,
    tags: PropTypes.object.isRequired,

    searchId: PropTypes.string,
    savedSearchList: PropTypes.array.isRequired,

    defaultQuery: PropTypes.string,
    sort: PropTypes.string,
    filter: PropTypes.string,
    query: PropTypes.string,
    isSearchDisabled: PropTypes.bool,
    queryCount: PropTypes.number,
    queryMaxCount: PropTypes.number,

    onSortChange: PropTypes.func,
    onSearch: PropTypes.func,
    onSidebarToggle: PropTypes.func,
    onSavedSearchCreate: PropTypes.func.isRequired
  },

  contextTypes: {
    location: PropTypes.object
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
