import React from "react";

import FilterSelectLink from "./filterSelectLink";
import SearchBar from "./searchBar";
import SortOptions from "./sortOptions";

const StreamFilters = React.createClass({
  propTypes: {
    orgId: React.PropTypes.string.isRequired,
    projectId: React.PropTypes.string.isRequired
  },

  contextTypes: {
    location: React.PropTypes.object
  },

  getDefaultProps() {
    return {
      defaultQuery: "",
      sort: "",
      filter: "",
      query: null,
      onFilterChange: function() {},
      onSortChange: function() {},
      onSearch: function() {},
      onSidebarToggle: function () {}
    };
  },

  getActiveButton() {
    let queryParams = this.context.location.query;
    let activeButton;
    if (queryParams.bookmarks) {
      activeButton = 'bookmarks';
    } else if (queryParams.assigned) {
      activeButton = 'assigned';
    } else {
      activeButton = 'all';
    }
    return activeButton;
  },

  onFilterChange(filter) {
    this.props.onFilterChange(filter);
  },

  render() {
    let activeButton = this.getActiveButton();
    return (
      <div className="filter-nav stream-header">
        <div className="row">
          <div className="col-sm-4 primary-filters">
            <div className="btn-group btn-group-justified">
              <FilterSelectLink label="All Events"
                isActive={activeButton === 'all'}
                onSelect={this.onFilterChange.bind(this, {})}
                extraClass="btn btn-all-events" />
              <FilterSelectLink label="Bookmarks"
                isActive={activeButton === 'bookmarks'}
                onSelect={this.onFilterChange.bind(this, {bookmarks: "1"})}
                extraClass="btn btn-middle btn-bookmarks" />
              <FilterSelectLink label="Assigned"
                isActive={activeButton === 'assigned'}
                onSelect={this.onFilterChange.bind(this, {assigned: "1"})}
                extraClass="btn btn-assigned" />
            </div>
          </div>
          <div className="col-sm-3">
            <ul className="stream-sort">
              <SortOptions
                sort={this.props.sort}
                onSelect={this.props.onSortChange} />
            </ul>
          </div>
          <div className="col-sm-5">
            <SearchBar
              orgId={this.props.orgId}
              projectId={this.props.projectId}
              ref="searchBar"
              tags={this.props.tags}
              defaultQuery={this.props.defaultQuery}
              placeholder="Search for events, users, tags, and everything else."
              query={this.props.query}
              onSearch={this.props.onSearch}
              disabled={this.props.isSearchDisabled}
              />
            <a className="btn btn-default toggle-stream-sidebar" onClick={this.props.onSidebarToggle}><span className="icon-filter"></span></a>
          </div>
        </div>
      </div>
    );
  }
});

export default StreamFilters;
