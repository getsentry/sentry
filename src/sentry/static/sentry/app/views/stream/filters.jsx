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
      onSidebarToggle: function () {}
    };
  },

  render() {
    let {access, orgId, projectId, searchId} = this.props;

    return (
      <div className="stream-header">
        <div className="row">
          <div className="col-sm-5">
            <SavedSearchSelector
              access={access}
              orgId={orgId}
              projectId={projectId}
              searchId={searchId}
              query={this.props.query}
              onSavedSearchCreate={this.props.onSavedSearchCreate}
              savedSearchList={this.props.savedSearchList} />
          </div>
          <div className="col-sm-7">
            <div className="search-container">
              <div className="stream-sort">
                <SortOptions
                  sort={this.props.sort}
                  onSelect={this.props.onSortChange} />
              </div>

              <SearchBar
                orgId={orgId}
                projectId={projectId}
                ref="searchBar"
                tags={this.props.tags}
                defaultQuery={this.props.defaultQuery || ''}
                placeholder={t('Search for events, users, tags, and everything else.')}
                query={this.props.query || ''}
                onSearch={this.props.onSearch}
                disabled={this.props.isSearchDisabled} />
              <a className="btn btn-default toggle-stream-sidebar" onClick={this.props.onSidebarToggle}>
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
