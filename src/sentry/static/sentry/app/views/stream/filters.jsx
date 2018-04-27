import PropTypes from 'prop-types';
import React from 'react';

import SavedSearchSelector from 'app/views/stream/savedSearchSelector';
import SearchBar from 'app/views/stream/searchBar';
import SortOptions from 'app/views/stream/sortOptions';
import {t} from 'app/locale';

class StreamFilters extends React.Component {
  static propTypes = {
    orgId: PropTypes.string.isRequired,
    projectId: PropTypes.string.isRequired,
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
      isSearchDisabled,
      sort,

      onSidebarToggle,
      onSearch,
      onSavedSearchCreate,
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
                placeholder={t('Search for events, users, tags, and everything else.')}
                query={query || ''}
                onSearch={onSearch}
                disabled={isSearchDisabled}
                excludeEnvironment={true}
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
