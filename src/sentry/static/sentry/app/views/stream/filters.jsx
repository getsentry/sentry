import React from "react";
import $ from "jquery";
var PureRenderMixin = require('react/addons').addons.PureRenderMixin;

import DateSelector from "./dateSelector";
import FilterSelectLink from "./filterSelectLink";
import SearchBar from "./searchBar";
import SearchDropdown from "./searchDropdown";
import utils from "../../utils";
import SortOptions from "./sortOptions";

var StreamFilters = React.createClass({
  contextTypes: {
    router: React.PropTypes.func
  },

  getDefaultProps() {
    return {
      defaultQuery: "",
      sort: "",
      filter: "",
      query: "",
      onFilterChange: function() {},
      onSortChange: function() {},
      onSearch: function() {}
    };
  },

  getInitialState() {
    return {
      activeButton: null
    };
  },

  componentWillMount() {
    this.setState({
      activeButton: this.getActiveButton()
    });
  },

  componentWillReceiveProps(nextProps) {
    var activeButton = this.getActiveButton();
    if (activeButton != this.state.activeButton) {
      this.setState({
        activeButton: activeButton
      });
    }
  },

  getActiveButton() {
    var router = this.context.router;
    var queryParams = router.getCurrentQuery();
    var activeButton;
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
    var activeButton = this.state.activeButton;
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
            <SearchBar defaultQuery={this.props.defaultQuery}
              placeholder="Search for events, users, tags, and everything else."
              query={this.props.query}
              onSearch={this.props.onSearch}>
              <SearchDropdown dropdownVisible={this.state.dropdownVisible} />
            </SearchBar>
          </div>
        </div>
      </div>
    );
  }
});

export default StreamFilters;
