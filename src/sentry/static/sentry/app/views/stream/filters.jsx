/*** @jsx React.DOM */
var React = require("react");
var $ = require("jquery");

var utils = require("../../utils");

var SearchDropdown = React.createClass({
  componentDidMount: function(){
    $('.filter-nav .search-input').focus(function(){
      $('.search-dropdown').show();
    }).blur(function(){
      $('.search-dropdown').hide();
    });
  },

  render: function() {
    return (
      <div className="search-dropdown" style={{display:"none"}}>
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
  propTypes: {
    query: React.PropTypes.string.isRequired,
    onQueryChange: React.PropTypes.func.isRequired
  },
  onQueryChange: function(event){
    return this.props.onQueryChange(event.target.value, event);
  },
  render: function() {
    return (
      <div className="search">
        <form className="form-horizontal" action="." method="GET">
          <div>
            <input type="text" className="search-input form-control"
                   placeholder="Search for events, users, tags, and everything else."
                   name="query"
                   value={this.props.query}
                   onChange={this.onQueryChange} />
            <span className="icon-search"></span>
          </div>
          <SearchDropdown />
        </form>
      </div>
    );
  }
});

var FilterSelectLink = React.createClass({
  render: function() {
    var className = this.props.extraClass;
    className += ' btn btn-default';

    if (this.props.isActive) {
      className += ' active';
    }

    var queryString = '?' + this.props.query;

    return (
      <a href={queryString}
          className={className}>{this.props.label}</a>
    );
  }
});

var StreamFilters = React.createClass({
  propTypes: {
    query: React.PropTypes.string.isRequired,
    onQueryChange: React.PropTypes.func.isRequired
  },
  render: function() {
    var params = utils.getQueryParams();
    var activeButton;
    if (params.bookmarks) {
      activeButton = 'bookmarks';
    } else if (params.assigned) {
      activeButton = 'assigned';
    } else {
      activeButton = 'all';
    }

    return (
      <div className="filter-nav" ng-controller="ProjectStreamControlsCtrl">
        <div className="row">
          <div className="col-sm-4 primary-filters">
            <div className="btn-group btn-group-justified">
              <FilterSelectLink label="All Events"
                                query=""
                                isActive={activeButton === 'all'}
                                extraClass="btn-all-events" />
              <FilterSelectLink label="Bookmarks"
                                query="bookmarks=1"
                                isActive={activeButton === 'bookmarks'}
                                extraClass="btn-middle btn-bookmarks" />
              <FilterSelectLink label="Assigned"
                                query="assigned=1"
                                isActive={activeButton === 'assigned'}
                                extraClass="btn-assigned" />
            </div>
          </div>
          <div className="col-sm-8">
            <SearchBar query={this.props.query} onQueryChange={this.props.onQueryChange} />
          </div>
        </div>
      </div>
    );
  }
});

module.exports = StreamFilters;
