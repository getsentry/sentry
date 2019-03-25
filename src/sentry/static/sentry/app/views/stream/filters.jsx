import PropTypes from 'prop-types';
import React from 'react';

import Feature from 'app/components/acl/feature';

import SearchBar from './searchBar';
import SortOptions from './sortOptions';
import SavedSearchSelector from './savedSearchSelector';
import OrganizationSavedSearchSelector from './organizationSavedSearchSelector';

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
    tagValueLoader: PropTypes.func.isRequired,
    tags: PropTypes.object.isRequired,
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
      tagValueLoader,
      tags,
    } = this.props;

    return (
      <div className="stream-header">
        <div className="row">
          <div className="col-sm-5">
            <Feature
              features={['org-saved-searches']}
              renderDisabled={() => (
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
              )}
            >
              <OrganizationSavedSearchSelector
                savedSearchList={savedSearchList}
                onSavedSearchSelect={onSavedSearchSelect}
                queryCount={queryCount}
                queryMaxCount={queryMaxCount}
              />
            </Feature>
          </div>
          <div className="col-sm-7">
            <div className="search-container">
              <div className="stream-sort">
                <SortOptions sort={sort} onSelect={onSortChange} />
              </div>

              <SearchBar
                orgId={orgId}
                query={query || ''}
                onSearch={onSearch}
                disabled={isSearchDisabled}
                excludeEnvironment={true}
                supportedTags={tags}
                tagValueLoader={tagValueLoader}
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
