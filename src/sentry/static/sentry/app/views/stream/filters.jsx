var React = require("react");
var $ = require("jquery");
var PureRenderMixin = require('react/addons').addons.PureRenderMixin;

var DateSelector = require("./dateSelector");
var FilterSelectLink = require("./filterSelectLink");
var SearchBar = require("./searchBar");
var utils = require("../../utils");
var SortOptions = require("./sortOptions");

var StreamFilters = React.createClass({
  contextTypes: {
    router: React.PropTypes.func
  },

  getDefaultProps() {
    return {
      defaultQuery: "",
      defaultDateFrom: "",
      filter: "",
      query: "",
      onFilterChange: function() {},
      onQueryChange: function() {},
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
          <div className="col-sm-8 primary-filters">
            <ul className="nav nav-tabs">
              <FilterSelectLink label="All"
                isActive={activeButton === 'all'}
                onSelect={this.onFilterChange.bind(this, {})}
                extraClass="btn-all-events" />
              <FilterSelectLink label="Bookmarks"
                isActive={activeButton === 'bookmarks'}
                onSelect={this.onFilterChange.bind(this, {bookmarks: "1"})}
                extraClass="btn-middle btn-bookmarks" />
              <FilterSelectLink label="Assigned"
                isActive={activeButton === 'assigned'}
                onSelect={this.onFilterChange.bind(this, {assigned: "1"})}
                extraClass="btn-assigned" />
              <li className="divider" />
              <li className="highlight">
                <SortOptions />
              </li>
              <li className="highlight">
                <DateSelector defaultDateFrom={this.props.defaultDateFrom} />
              </li>
            </ul>
          </div>
          <div className="col-sm-4">
            <SearchBar defaultQuery={this.props.defaultQuery}
              query={this.props.query}
              onQueryChange={this.props.onQueryChange}
              onSearch={this.props.onSearch} />
          </div>
        </div>
      </div>
    );
  }
});

module.exports = StreamFilters;
