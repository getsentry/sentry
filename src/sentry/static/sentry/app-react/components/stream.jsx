/*** @jsx React.DOM */
var React = require("react");
var $ = require("jquery");

var utils = require("../utils");

var Count = require("./count");
var Modal = require("react-bootstrap/Modal");
var OverlayMixin = require("react-bootstrap/OverlayMixin");
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

var ActionLink = React.createClass({
  mixins: [OverlayMixin],

  propTypes: {
    aggList: React.PropTypes.array.isRequired,
    selectAllActive: React.PropTypes.bool.isRequired,
    canActionAll: React.PropTypes.bool.isRequired,
    confirmLabel: React.PropTypes.string,
    actionLabel: React.PropTypes.string,
    onlyIfBulk: React.PropTypes.bool,
    neverConfirm: React.PropTypes.bool,
  },

  getDefaultProps: function() {
    return {
      confirmLabel: 'Edit',
      onlyIfBulk: false,
      neverConfirm: false
    };
  },

  getInitialState: function() {
    return {
      isModalOpen: false
    };
  },

  handleToggle: function() {
    this.setState({
      isModalOpen: !this.state.isModalOpen
    });
  },

  handleActionAll: function(event) {
    console.log('actioning all');
  },

  handleActionSelected: function(event) {
    console.log('actioning selected');
  },

  defaultActionLabel: function(confirmLabel) {
    return confirmLabel.toLowerCase() + ' these {count} events';
  },

  render: function () {
    return (
      <a {...this.props} onClick={this.handleToggle}>
        {this.props.children}
      </a>
    );
  },

  renderOverlay: function() {
    if (!this.state.isModalOpen) {
      return <span/>;
    }

    var selectedAggList = [];
    for (var i = 0, node; (node = this.props.aggList[i]); i++) {
      if (node.isSelected === true) {
        selectedAggList.push(node);
      }
    }

    if (selectedAggList.length === 0) {
      throw new Error('ActionModal rendered without any selected aggregates');
    }

    var shouldConfirm = true;
    // if skipConfirm is set we never actually show the modal
    if (this.props.neverConfirm === true) {
      shouldConfirm = false;
    // if onlyIfBulk is set and we've selected a single item, we skip
    // showing the modal
    } else if (this.props.onlyIfBulk === true && !this.props.selectAllActive) {
      shouldConfirm = false;
    }

    if (!shouldConfirm) {
      this.handleActionSelected();
      this.state.isModalOpen = false;
      return '<span/>';
    }

    var confirmLabel = this.props.confirmLabel;
    var actionLabel = this.props.actionLabel || this.defaultActionLabel(confirmLabel);
    var numEvents = selectedAggList.length;

    actionLabel = actionLabel.replace('{count}', numEvents);

    return (
      <Modal title="Please confirm" animation={false} onRequestHide={this.handleToggle}>
        <div className="modal-body">
          <p><strong>Are you sure that you want to {actionLabel}?</strong></p>
          <p>This action cannot be undone.</p>
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-default"
                  onClick={this.handleToggle}>Cancel</button>
          {this.props.canActionAll &&
            <button type="button" className="btn btn-danger"
                    onClick={this.handleActionAll}>{confirmLabel} all recorded events</button>
          }
          <button type="button" className="btn btn-primary"
                  onClick={this.handleActionSelected}>{confirmLabel} {numEvents} selected events</button>
        </div>
      </Modal>
    );
  }
});

var Actions = React.createClass({
  propTypes: {
    aggList: React.PropTypes.array.isRequired,
    anySelected: React.PropTypes.bool.isRequired,
    selectAllActive: React.PropTypes.bool.isRequired,
    multiSelected: React.PropTypes.bool.isRequired,
    onSelectAll: React.PropTypes.func.isRequired,
    onResolve: React.PropTypes.func.isRequired,
    onBookmark: React.PropTypes.func.isRequired,
    onRemoveBookmark: React.PropTypes.func.isRequired,
    onDelete: React.PropTypes.func.isRequired,
    onMerge: React.PropTypes.func.isRequired
  },
  render: function() {
    return (
      <div className="stream-actions">
        <div className="stream-actions-left stream-actions-cell">
          <div className="checkbox">
            <input type="checkbox" className="chk-select-all"
                   onChange={this.props.onSelectAll}
                   checked={this.props.selectAllActive} />
          </div>
          <div className="btn-group">
            <ActionLink
               className="btn btn-default btn-sm action-resolve"
               disabled={!this.props.anySelected}
               onAction={this.props.onResolve}
               confirmLabel="Resolve"
               canActionAll={true}
               onlyIfBulk={true}
               selectAllActive={this.props.selectAllActive}
               aggList={this.props.aggList}>
              <i aria-hidden="true" className="icon-checkmark"></i>
            </ActionLink>
            <ActionLink
               className="btn btn-default btn-sm action-bookmark"
               disabled={!this.props.anySelected}
               onAction={this.props.onBookmark}
               neverConfirm={true}
               confirmLabel="Bookmark"
               canActionAll={false}
               onlyIfBulk={true}
               selectAllActive={this.props.selectAllActive}
               aggList={this.props.aggList}>
              <i aria-hidden="true" className="icon-bookmark"></i>
            </ActionLink>
            <a className="btn btn-default btn-sm hidden-xs action-more dropdown-toggle"
               disabled={!this.props.anySelected} data-toggle="dropdown">
              <span className="icon-ellipsis"></span>
            </a>

            <ul className="dropdown-menu more-menu">
              <li><ActionLink
                 className="action-merge"
                 disabled={!this.props.multiSelected}
                 onAction={this.props.onMerge}
                 confirmLabel="Merge"
                 canActionAll={false}
                 selectAllActive={this.props.selectAllActive}
                 aggList={this.props.aggList}>
                Merge Events
              </ActionLink></li>
              <li><ActionLink
                 className="action-remove-bookmark"
                 disabled={!this.props.anySelected}
                 onAction={this.props.onRemoveBookmark}
                 neverConfirm={true}
                 actionLabel="remove these {count} events from your bookmarks"
                 onlyIfBulk={true}
                 canActionAll={false}
                 selectAllActive={this.props.selectAllActive}
                 aggList={this.props.aggList}>
                Remove from Bookmarks
              </ActionLink></li>
              <li className="divider"></li>
              <li>
              <li><ActionLink
                 className="action-delete"
                 disabled={!this.props.anySelected}
                 onAction={this.props.onRemoveBookmark}
                 confirmLabel="Delete"
                 canActionAll={false}
                 selectAllActive={this.props.selectAllActive}
                 aggList={this.props.aggList}>
                Delete Events
              </ActionLink></li>
              <a href="#" className="action-delete"
                     disabled={!this.props.anySelected}>Delete Events</a></li>
            </ul>
          </div>

          <div className="btn-group">
            <a href="#" className="btn btn-default btn-sm hidden-xs realtime-control">
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
  propTypes: {
    data: React.PropTypes.shape({
      id: React.PropTypes.string
    }),
    isSelected: React.PropTypes.bool
  },
  render: function() {
    var data = this.props.data,
        userCount = 0;

    if (data.tags["sentry:user"] !== undefined) {
      userCount = data.tags["sentry:user"].count;
    }

    var className = "group";
    if (this.props.isBookmarked) {
      className += ' isBookmarked';
    }
    if (this.props.hasSeen) {
      className += ' hasSeen';
    }

    return (
      <li className={className}>
        <div className="event-details event-cell">
          <div className="checkbox">
            <input type="checkbox" className="chk-select" value={data.id}
                   checked={this.props.isSelected}
                   onChange={this.props.onSelect} />
          </div>
          <h3><a href={data.permalink}>
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

var Stream = React.createClass({
  propTypes: {
    aggList: React.PropTypes.array.isRequired
  },
  getInitialState: function() {
    return {
      aggList: [],
      selectAllActive: false,
      multiSelected: false,
      anySelected: false
    };
  },
  componentWillMount: function() {
    this.state.aggList = this.props.aggList || [];
  },
  handleSelect: function(aggId, event) {
    var checked = $(event.target).is(':checked');
    var aggList = this.state.aggList;
    var aggNode = null;

    var numSelected = 0,
        numTotal = 0;

    for (var i = 0, node; (node = this.state.aggList[i]); i++) {
      if (aggId === node.id) {
        aggNode = node;
        aggNode.isSelected = checked;
      }

      if (node.isSelected) {
        numSelected += 1;
      }
      numTotal += 1;
    }

    if (aggNode === null) {
      throw new Error('Unable to find aggregate node for ID ' + aggId);
    }

    this.setState({
      aggList: aggList,
      selectAllActive: (numSelected === numTotal),
      anySelected: numSelected !== 0,
      multiSelected: numSelected > 1
    });
  },
  handleSelectAll: function(event){
    var checked = $(event.target).is(':checked');
    var aggList = this.state.aggList;
    var numSelected = checked ? aggList.length : 0;

    for (var i = 0, node; (node = aggList[i]); i++) {
      node.isSelected = checked;
    }

    this.setState({
      aggList: aggList,
      selectAllActive: checked,
      anySelected: numSelected !== 0,
      multiSelected: numSelected > 1
    });
  },
  handleAction: function(event){
  },
  handleResolve: function(aggList, event){
    // return this.props.onAction(aggList, {status: 'resolved'}, event);
  },
  handleBookmark: function(aggList, event){
    // return this.props.onAction(aggList, {isBookmarked: 1}, event);
  },
  handleRemoveBookmark: function(aggList, event){
    // return this.props.onAction(aggList, {isBookmarked: 1}, event);
  },
  handleDelete: function(aggList, event){
    // return this.props.onAction(aggList, {isBookmarked: 1}, event);
  },
  handleMerge: function(aggList, event) {

  },
  render: function() {
    var aggNodes = this.state.aggList.map(function(node) {
      return (
        <Aggregate data={node} key={node.id}
                   isSelected={node.isSelected}
                   onSelect={this.handleSelect.bind(this, node.id)} />
      );
    }.bind(this));

    return (
      <div>
        <FilterSelect />
        <div className="group-header-container" data-spy="affix" data-offset-top="134">
          <div className="container">
            <div className="group-header">
              <Actions onSelectAll={this.handleSelectAll}
                       onResolve={this.handleResolve}
                       onBookmark={this.handleBookmark}
                       onDelete={this.handleDelete}
                       onMerge={this.handleMerge}
                       onRemoveBookmark={this.handleRemoveBookmark}
                       aggList={this.state.aggList}
                       selectAllActive={this.state.selectAllActive}
                       anySelected={this.state.anySelected}
                       multiSelected={this.state.multiSelected} />
            </div>
          </div>
        </div>
        <ul className="group-list">
          {aggNodes}
        </ul>
      </div>
    );
  }
});

module.exports = Stream;
