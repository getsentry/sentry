var React = require("react");
var $ = require("jquery");
var PureRenderMixin = require('react/addons').addons.PureRenderMixin;

var FilterSelectLink = require("./filterSelectLink");
var SearchBar = require("./searchBar");
var utils = require("../../utils");

var StreamFilters = React.createClass({
  mixins: [PureRenderMixin],

  contextTypes: {
    router: React.PropTypes.func
  },

  getDefaultProps() {
    return {
      defaultQuery: ""
    };
  },

  getInitialState() {
    return {
      activeButton: null,
      query: this.props.defaultQuery,
      filter: ""
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

  onSearch(query) {
    this.setState({
      query: query
    }, function() {
      this.transitionTo();
    });
  },

  onFilterChange(filter) {
    this.setState({
      filter: filter
    }, function() {
      this.transitionTo();
    });
  },

  transitionTo() {
    var router = this.context.router;
    var queryParams = {};

    for (var prop in this.state.filter) {
      queryParams[prop] = this.state.filter[prop];
    }
    if (this.state.query !== this.props.defaultQuery) {
      queryParams.query = this.state.query;
    }

    router.transitionTo('stream', router.getCurrentParams(), queryParams);
  },

  render() {
    var activeButton = this.state.activeButton;
    return (
      <div className="filter-nav">
        <div className="row">
          <div className="col-sm-4 primary-filters">
            <div className="btn-group btn-group-justified">
              <FilterSelectLink label="All Events"
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
            </div>
          </div>
          <div className="col-sm-8">
            <SearchBar onSearch={this.onSearch} defaultQuery={this.state.query} />
          </div>
        </div>
      </div>
    );
  }
});

module.exports = StreamFilters;
