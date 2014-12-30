/*** @jsx React.DOM */
var React = require("react");

var utils = require("../utils");

var Count = require("./count");
var TimeSince = require("./timeSince");

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
  render: function() {
    return (
      <div className="search">
        <form className="form-horizontal" action="." method="GET">
          <div>
            <input type="text" className="search-input form-control"
                   placeholder="Search for events, users, tags, and everything else."
                   name="query" />
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

var FilterSelect = React.createClass({
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
            <SearchBar />
          </div>
        </div>
      </div>
    );
  }
});

var Actions = React.createClass({
  render: function() {
    return (
      <div className="stream-actions">
        <div className="stream-actions-left stream-actions-cell">
          <div className="checkbox">
            <input type="checkbox" className="chk-select-all"/>
          </div>
          <div className="btn-group">
            <a href="javascript:void(0)" className="btn btn-default btn-sm action action-resolve">
              <i aria-hidden="true" className="icon-checkmark"></i>
            </a>
            <a href="javascript:void(0)" className="btn btn-default btn-sm action action-bookmark">
              <span className="icon icon-bookmark"></span>
            </a>
            <a className="btn btn-default btn-sm hidden-xs action action-more dropdown-toggle" data-toggle="dropdown">
              <span className="icon-ellipsis"></span>
            </a>

            <ul className="dropdown-menu more-menu">
              <li><a href="javascript:void(0)" className="action action-merge">Merge Events</a></li>
              <li><a href="javascript:void(0)" className="action action-remove-bookmark">Remove from Bookmarks</a></li>
              <li className="divider"></li>
              <li><a href="javascript:void(0)" className="action action-delete">Delete Events</a></li>
            </ul>
          </div>

          <div className="btn-group">
            <a href="javascript:void(0)" className="btn btn-default btn-sm hidden-xs realtime-control">
              <span className="icon icon-pause"></span>
            </a>
          </div>
          <div className="btn-group">
            <a href="#" className="btn dropdown-toggle btn-sm" data-toggle="dropdown">
              <span className="hidden-sm hidden-xs">Sort by:</span> sortLabel
              <span aria-hidden="true" className="icon-arrow-down"></span>
            </a>
            <ul className="dropdown-menu">
              <li className="active"><a href="?sort=priority">Priority</a></li>
              <li><a href="?sort=date">Last Seen</a></li>
              <li><a href="?sort=new">First Seen</a></li>
              <li><a href="?sort=freq">Frequency</a></li>
            </ul>
          </div>
          <div className="btn-group">
            <a href="#" className="btn dropdown-toggle btn-sm" onclick="" data-toggle="dropdown">
              All time
            <span aria-hidden="true" className="icon-arrow-down"></span></a>
            <div className="datepicker-box dropdown-menu" id="daterange">
              <form method="GET" action=".">
                <div className="input">
                  <div className="inline-inputs">
                    <input data-toggle="datepicker" data-date-format="yyyy-mm-dd"name="df" className="form-control date" type="text" placeholder="Date" />
                    <input className="time form-control" type="text" name="tf" placeholder="Time" />
                    to
                    <input data-toggle="datepicker" data-date-format="yyyy-mm-dd" name="dt" className="date form-control" type="text" placeholder="Date"/>
                    <input className="time form-control" type="text" name="tt" placeholder="Time" />
                  </div>
                  <div className="help-block">All events are represented in UTC time.</div>
                </div>
                <div className="submit">
                  <div className="pull-right">
                    <button className="btn btn-default btn-sm">Clear</button>
                    <button className="btn btn-primary btn-sm">Apply</button>
                  </div>
                  <div className="radio-inputs">
                    <label className="radio">
                      <input type="radio" name="date_type" value="last_seen" /> Last Seen
                    </label>
                    <label className="radio">
                      <input type="radio" name="date_type" value="first_seen" /> First Seen
                    </label>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
        <div className="hidden-sm hidden-xs stream-actions-assignee stream-actions-cell">
        </div>
        <div className="hidden-sm hidden-xs stream-actions-graph stream-actions-cell">
          <ul className="toggle-graph">
            <li><a>24h</a></li>
            <li><a>30d</a></li>
          </ul>
        </div>
        <div className="stream-actions-occurrences stream-actions-cell align-center hidden-xs"> events</div>
        <div className="stream-actions-users stream-actions-cell align-center hidden-xs"> users</div>
      </div>
    );
  }
});

var Aggregate = React.createClass({
  render: function() {
    var data = this.props.data,
        userCount = 0;

    if (data.tags['sentry:user'] !== undefined) {
      userCount = data.tags['sentry:user'].count;
    }

    return (
      <li className="group">
        <div className="event-details event-cell">
          <div className="checkbox">
              <input type="checkbox" className="chk-select" value="{data.id}" />
          </div>
          <h3><a href="">
            <span className="icon icon-bookmark"></span>
            {data.title}
          </a></h3>
          <div className="event-message">
            <span className="message">{data.culprit}</span>
          </div>
          <div className="event-meta">
            <span className="last-seen"><TimeSince date={data.lastSeen} /></span>
            &nbsp;&mdash;&nbsp;
            <span className="first-seen">from <TimeSince date={data.firstSeen} /></span>
          </div>
        </div>
        <div className="event-assignee event-cell hidden-xs hidden-sm">

        </div>
        <div className="hidden-sm hidden-xs event-graph align-right event-cell">

        </div>
        <div className="hidden-xs event-occurrences align-center event-cell">
          <Count value={data.count} />
        </div>
        <div className="hidden-xs event-users align-center event-cell">
          <Count value={userCount} />
        </div>
      </li>
    );
  }
});

var AggregateList = React.createClass({
  render: function() {
    var nodes = this.props.data.map(function(aggregate) {
      return (
        <Aggregate data={aggregate} />
      );
    });

    return (
      <ul className="group-list">
        {nodes}
      </ul>
    );
  }
});

var Stream = React.createClass({
  getInitialState: function() {
    return {data: this.props.data || []};
  },
  render: function() {
    return (
      <div>
        <FilterSelect />
        <div className="group-header-container" data-spy="affix" data-offset-top="134">
          <div className="container">
            <div className="group-header">
              <Actions/>
            </div>
          </div>
        </div>
        <AggregateList data={this.state.data} />
      </div>
    );
  }
});

module.exports = Stream;
