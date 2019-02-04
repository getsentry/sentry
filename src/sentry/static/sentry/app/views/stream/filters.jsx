import PropTypes from 'prop-types';
import React from 'react';

import SavedSearchSelector from 'app/views/stream/savedSearchSelector';
import SearchBar from 'app/views/stream/searchBar';
import SortOptions from 'app/views/stream/sortOptions';
import TagStore from 'app/stores/tagStore';

class StreamFilters extends React.Component {
  static propTypes = {
    orgId: PropTypes.string.isRequired,
    projectId: PropTypes.string,
    access: PropTypes.object.isRequired,

    searchId: PropTypes.string,
    savedSearchList: PropTypes.array.isRequired,

    sort: PropTypes.string,
    query: PropTypes.string,
    isSearchDisabled: PropTypes.bool,
    queryCount: PropTypes.number,
    queryMaxCount: PropTypes.number,

    onSortChange: PropTypes.func,
    onSearch: PropTypes.func,
    onSidebarToggle: PropTypes.func,
    onSavedSearchCreate: PropTypes.func.isRequired,
    onSavedSearchSelect: PropTypes.func.isRequired,
  };

  static contextTypes = {
    location: PropTypes.object,
  };

  static defaultProps = {
    projectId: null,
    sort: '',
    query: null,
    onSortChange: function() {},
    onSearch: function() {},
    onSidebarToggle: function() {},
  };

  render() {
    const {
      access,
      orgId,
      projectId,
      searchId,
      queryCount,
      queryMaxCount,
      query,
      savedSearchList,
      isSearchDisabled,
      sort,

      onSidebarToggle,
      onSearch,
      onSavedSearchCreate,
      onSavedSearchSelect,
      onSortChange,
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
              onSavedSearchSelect={onSavedSearchSelect}
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
                query={query || ''}
                onSearch={onSearch}
                disabled={isSearchDisabled}
                excludeEnvironment={true}
                supportedTags={TagStore.getAllTags()}
              />
              <a
                className="btn btn-default toggle-stream-sidebar"
                onClick={onSidebarToggle}
              >
                <span className="icon-filter" />
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }
}

export default StreamFilters;
