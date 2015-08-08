import React from "react";
var PureRenderMixin = require('react/addons').addons.PureRenderMixin;

import SearchDropdown from "./searchDropdown";

var SearchBar = React.createClass({
  contextTypes: {
    router: React.PropTypes.func
  },

  mixins: [PureRenderMixin],

  getDefaultProps() {
    return {
      defaultQuery: "",
      query: "",
      onSearch: function() {},
      onQueryChange: function() {}
    };
  },

  getInitialState() {
    return {
      dropdownVisible: false
    };
  },

  blur() {
    this.refs.searchInput.getDOMNode().blur();
  },

  onSubmit(event) {
    event.preventDefault();
    this.blur();
    this.props.onSearch();
  },

  clearSearch() {
    this.props.onQueryChange(this.props.defaultQuery, this.props.onSearch);
  },

  onQueryFocus() {
    this.setState({
      dropdownVisible: true
    });
  },

  onQueryBlur() {
    this.setState({
      dropdownVisible: false
    });
  },

  onQueryChange(event) {
    this.props.onQueryChange(event.target.value);
  },

  onKeyUp(event) {
    if (event.key === 'Escape' || event.keyCode === 27) {
      // blur handler should additionally hide dropdown
      this.blur();
    }
  },

  render() {
    return (
      <div className="search">
        <form className="form-horizontal" ref="searchForm" onSubmit={this.onSubmit}>
          <div>
            <input type="text" className="search-input form-control"
              placeholder="Search for events, users, tags, and everything else."
              name="query"
              ref="searchInput"
              autoComplete="off"
              value={this.props.query}
              onFocus={this.onQueryFocus}
              onBlur={this.onQueryBlur}
              onKeyUp={this.onKeyUp}
              onChange={this.onQueryChange} />
            <span className="icon-search" />
            {this.props.query !== this.props.defaultQuery &&
              <div>
                <a className="search-clear-form" onClick={this.clearSearch}>
                  <span className="icon-circle-cross" />
                </a>
              </div>
            }
          </div>
          <SearchDropdown dropdownVisible={this.state.dropdownVisible} />
        </form>
      </div>
    );
  }
});

export default SearchBar;
