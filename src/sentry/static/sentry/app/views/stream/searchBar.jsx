var React = require("react");
var PureRenderMixin = require('react/addons').addons.PureRenderMixin;

var SearchDropdown = require("./searchDropdown");

var SearchBar = React.createClass({
  contextTypes: {
    router: React.PropTypes.func
  },

  mixins: [PureRenderMixin],

  getDefaultProps() {
    return {
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

  onSubmit(event) {
    event.preventDefault();
    this.refs.searchInput.getDOMNode().blur();
    this.props.onSearch();
  },

  clearSearch() {
    this.props.onQueryChange("");
    this.props.onSearch();
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
              onChange={this.onQueryChange} />
            <span className="icon-search" />
            {this.props.query !== '' &&
              <div>
                <a className="search-save-search btn btn-xs btn-default">Save</a>
                <a className="search-clear-form" onClick={this.clearSearch}>
                  <span className="icon-close" />
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

module.exports = SearchBar;
