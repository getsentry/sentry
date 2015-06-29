var React = require("react");
var $ = require("jquery");
var PureRenderMixin = require('react/addons').addons.PureRenderMixin;

var utils = require("../../utils");

var SearchDropdown = React.createClass({
  mixins: [PureRenderMixin],

  propTypes: {
    dropdownVisible: React.PropTypes.bool
  },

  getDefaultProps() {
    return {
      dropdownVisible: false
    };
  },

  render() {
    var style = {
      display: this.props.dropdownVisible ? 'block' : 'none'
    };

    return (
      <div className="search-dropdown" style={style}>
        <ul className="search-helper search-autocomplete-list">
          <li className="search-autocomplete-item">
            <span className="icon icon-tag"></span>
            <h4>Tag - <span className="search-description">key/value pair associated to an event</span></h4>
            <p className="search-example">browser:"Chrome 34"</p>
          </li>
          <li className="search-autocomplete-item">
            <span className="icon icon-toggle"></span>
            <h4>Status - <span className="search-description">State of an event</span></h4>
            <p className="search-example">is:resolved, unresolved, muted</p>
          </li>
          <li className="search-autocomplete-item">
            <span className="icon icon-user"></span>
            <h4>Assigned - <span className="search-description">team member assigned to an event</span></h4>
            <p className="search-example">assigned:[me|user@example.com]</p>
          </li>
        </ul>
      </div>
    );
  }
});

var SearchBar = React.createClass({
  contextTypes: {
    router: React.PropTypes.func
  },

  mixins: [PureRenderMixin],

  getInitialState() {
    var router = this.context.router;
    var queryParams = router.getCurrentQuery();

    var query = (typeof queryParams.query === 'undefined' ?
      'is:unresolved' :
      queryParams.query);

    return {
      dropdownVisible: false,
      query: query
    };
  },

  onSubmit(event) {
    var router = this.context.router;
    var queryParams = router.getCurrentQuery();

    queryParams.query = this.state.query;

    event.preventDefault();

    this.refs.searchInput.getDOMNode().blur();

    router.transitionTo('stream', router.getCurrentParams(), queryParams);
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

  onQueryChange() {
    this.setState({
      query: event.target.value
    });
  },

  render() {
    return (
      <div className="search">
        <form className="form-horizontal" onSubmit={this.onSubmit}>
          <div>
            <input type="text" className="search-input form-control"
                   placeholder="Search for events, users, tags, and everything else."
                   name="query"
                   ref="searchInput"
                   value={this.state.query}
                   onFocus={this.onQueryFocus}
                   onBlur={this.onQueryBlur}
                   onChange={this.onQueryChange} />
            <span className="icon-search"></span>
            <a href="#" className="search-clear-form"><span className="icon-close"></span></a>
          </div>
          <SearchDropdown dropdownVisible={this.state.dropdownVisible} />
        </form>
      </div>
    );
  }
});

var FilterSelectLink = React.createClass({
  contextTypes: {
    router: React.PropTypes.func
  },

  propTypes: {
    query: React.PropTypes.object.isRequired
  },

  render() {
    var router = this.context.router;
    var queryParams = router.getCurrentQuery();
    var params = router.getCurrentParams();
    var className = this.props.extraClass;
    className += ' btn btn-default';

    if (this.props.isActive) {
      className += ' active';
    }

    // whitelist relevant params
    var finalQueryParams = $.extend({
      query: queryParams.query,
      sort: queryParams.sort
    }, this.props.query);

    return (
      <Router.Link
          to="stream"
          activeClassName=""
          params={params}
          query={finalQueryParams}
          className={className}>
        {this.props.label}
      </Router.Link>
    );
  }
});

var StreamFilters = React.createClass({
  mixins: [PureRenderMixin],

  contextTypes: {
    router: React.PropTypes.func
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

  render() {
    var activeButton = this.state.activeButton;
    return (
      <div className="filter-nav">
        <div className="row">
          <div className="col-sm-4 primary-filters">
            <div className="btn-group btn-group-justified">
              <FilterSelectLink label="All Events"
                                query={{}}
                                isActive={activeButton === 'all'}
                                extraClass="btn-all-events" />
              <FilterSelectLink label="Bookmarks"
                                query={{bookmarks: '1'}}
                                isActive={activeButton === 'bookmarks'}
                                extraClass="btn-middle btn-bookmarks" />
              <FilterSelectLink label="Assigned"
                                query={{assigned: '1'}}
                                isActive={activeButton === 'assigned'}
                                extraClass="btn-assigned" />
            </div>
          </div>
          <div className="col-sm-8">
            <SearchBar />
          </div>
        </div>
      </div>
    );
  }
});

module.exports = StreamFilters;
