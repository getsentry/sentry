/*** @jsx React.DOM */
var React = require("react");
var $ = require("jquery");

var alertActions = require("../actions/alertActions");
var AssigneeSelector = require("./assigneeSelector");
var BarChart = require("./barChart");
var Count = require("./count");
var StreamActions = require('./streamActions');
var StreamFilters = require('./streamFilters');
var StreamPagination = require('./streamPagination');
var TimeSince = require("./timeSince");
var utils = require("../utils");

var Aggregate = React.createClass({
  propTypes: {
    data: React.PropTypes.shape({
      id: React.PropTypes.string.isRequired
    }).isRequired,
    memberList: React.PropTypes.instanceOf(Array),
    onSelect: React.PropTypes.func.isRequired,
    onAssignTo: React.PropTypes.func.isRequired,
    statsPeriod: React.PropTypes.string.isRequired,
    isSelected: React.PropTypes.bool
  },
  render: function() {
    var data = this.props.data,
        userCount = 0;

    var chartData = data.stats[this.props.statsPeriod].map(function(point){
      return {x: point[0], y: point[1]};
    });

    if (data.tags["sentry:user"] !== undefined) {
      userCount = data.tags["sentry:user"].count;
    }

    var className = "group";
    if (data.isBookmarked) {
      className += " isBookmarked";
    }
    if (data.hasSeen) {
      className += " hasSeen";
    }
    if (data.status === "resolved") {
      className += " isResolved";
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
          <AssigneeSelector
            aggregate={data}
            memberList={this.props.memberList}
            onAssignTo={this.props.onAssignTo} />
        </div>
        <div className="hidden-sm hidden-xs event-graph align-right event-cell">
          <BarChart points={chartData} className="sparkline" />
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

var StreamPoller = function(options){
  this.options = options;
  this._timeoutId = null;
  this._active = true;
  this._delay = 3000;
  this._pollingEndpoint = options.endpoint;
};
StreamPoller.prototype.enable = function(){
  this._active = true;
  if (!this._timeoutId) {
    this._timeoutId = window.setTimeout(this.poll.bind(this), this._delay);
  }
};
StreamPoller.prototype.disable = function(){
  this._active = false;
  if (this._timeoutId) {
    window.clearTimeout(this._timeoutId);
    this._timeoutId = null;
  }
};
StreamPoller.prototype.poll = function() {
  $.ajax({
    url: this._pollingEndpoint,
    method: 'GET',
    success: function(data, textStatus, jqXHR){
      // cancel in progress operation if disabled
      if (!this._active) {
        return;
      }

      // if theres no data, nothing changes
      if (!data.length) {
        return;
      }

      var links = utils.parseLinkHeader(jqXHR.getResponseHeader('Link'));
      this._pollingEndpoint = links.previous.href;

      this.options.success(data);
    }.bind(this),
    complete: function(){
      if (this._active) {
        this._timeoutId = window.setTimeout(this.poll.bind(this), this._delay);
      }
    }.bind(this)
  });
};

var Stream = React.createClass({
  propTypes: {
    aggList: React.PropTypes.array.isRequired,
    project: React.PropTypes.shape({
      id: React.PropTypes.string.isRequired
    }).isRequired,
    memberList: React.PropTypes.instanceOf(Array),
    initialQuery: React.PropTypes.string,
    pageLinks: React.PropTypes.string
  },
  getInitialState: function() {
    return {
      aggList: new utils.Collection(this.props.aggList, {
        sortFunc: function(data) {
          utils.sortArray(data, function(item){
            return [item.sortWeight];
          });
        },
        equals: function(self, other) {
          return self.id === other.id;
        },
        limit: 50
      }),
      selectAllActive: false,
      multiSelected: false,
      anySelected: false,
      statsPeriod: '24h',
      query: this.props.initialQuery,
      pageLinks: this.props.pageLinks,
      realtimeActive: true
    };
  },
  componentDidMount: function() {
    this._poller = new StreamPoller({
      success: this.handleRealtimePoll,
      endpoint: this.getPollingEndpoint()
    });
    if (this.state.realtimeActive) {
      this._poller.enable();
    }
  },
  componentWillUnmount: function() {
    this._poller.disable();
  },
  componentDidUpdate: function(prevProps, prevState) {
    if (prevState.realtimeActive !== this.state.realtimeActive) {
      if (this.state.realtimeActive) {
        this._poller.enable();
      } else {
        this._poller.disable();
      }
    }
  },
  getPollingEndpoint: function() {
    return '/api/0/projects/' + this.props.project.id + '/groups/?' + window.location.search;
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
  actionAggregates: function(aggList, options) {
    var url = options.url || '/api/0/projects/' + this.props.project.id + '/groups/';

    var selectedAggList;
    if (aggList === StreamActions.SELECTED) {
      selectedAggList = [];
      for (var i = 0, node; (node = this.props.aggList[i]); i++) {
        if (node.isSelected === true) {
          selectedAggList.push(node);
        }
      }
      url += '?id=' + selectedAggList.map(function(node){ return node.id; }).join('&id=');
    } else {
      selectedAggList = this.props.aggList;
    }

    var data = options.data || {};

    // TODO(dcramer): handle errors
    $.ajax({
      url: url,
      method: options.method || 'PUT',
      contentType: 'application/json',
      data: JSON.stringify(data)
    });

    if (aggList === StreamActions.ALL) {
      aggList = this.props.aggList;
    }
    selectedAggList.forEach(function(node){
      node.version = new Date().getTime() + 10;
      node.isSelected = false;
      for (var key in data) {
        node[key] = data[key];
      }
    });

    if (typeof options.success !== "undefined") {
      options.success(selectedAggList);
    }

    this.setState({
      aggList: this.props.aggList,
      selectAllActive: false,
      anySelected: false,
      multiSelected: false
    });
  },
  handleAssignTo: function(agg, member) {
    $.ajax({
      url: '/api/0/groups/' + $scope.group.id + '/',
      method: 'PUT',
      data: JSON.stringify({
        assignedTo: user.email
      }),
      contentType: 'application/json',
      success: function(data){
        $timeout(function(){
          $scope.group.assignedTo = user;
        });
      },
      error: function(){
        flash('error', 'Unable to change assignee. Please try again.');
      }
    });
  },
  handleResolve: function(aggList, event){
    return this.actionAggregates(aggList, {
      data: {status: 'resolved'}
    });
  },
  handleBookmark: function(aggList, event){
    return this.actionAggregates(aggList, {
      data: {isBookmarked: true}
    });
  },
  handleRealtimeChange: function(event) {
    this.setState({
      realtimeActive: !this.state.realtimeActive
    });
  },
  handleRemoveBookmark: function(aggList, event){
    return this.actionAggregates(aggList, {
      data: {isBookmarked: false}
    });
  },
  handleDelete: function(aggList, event){
    return this.actionAggregates(aggList, {
      method: 'DELETE',
      success: function() {
        alertActions.addAlert('The selected events have been scheduled for deletion.', 'success');
      }
    });
  },
  handleMerge: function(aggList, event) {
    return this.actionAggregates(aggList, {
      data: {merge: 1},
      success: function() {
        alertActions.addAlert('The selected events have been scheduled for merge.', 'success');
      }
    });
  },
  handleSelectStatsPeriod: function(period) {
    this.setState({
      statsPeriod: period
    });
  },
  handleQueryChange: function(value, event) {
    this.setState({
      query: value
    });
  },
  handleRealtimePoll: function(data) {
    this.setState({
      aggList: this.state.aggList.unshift(data)
    });
  },
  render: function() {
    var aggNodes = this.state.aggList.map(function(node) {
      return (
        <Aggregate data={node} key={node.id}
                   isSelected={node.isSelected}
                   memberList={this.props.memberList}
                   onSelect={this.handleSelect.bind(this, node.id)}
                   onAssignTo={this.handleAssignTo.bind(this, node.id)}
                   statsPeriod={this.state.statsPeriod} />
      );
    }.bind(this));

    return (
      <div>
        <StreamFilters query={this.state.query} onQueryChange={this.handleQueryChange} />
        <div className="group-header-container" data-spy="affix" data-offset-top="134">
          <div className="container">
            <div className="group-header">
              <StreamActions
                onSelectAll={this.handleSelectAll}
                onResolve={this.handleResolve}
                onBookmark={this.handleBookmark}
                onDelete={this.handleDelete}
                onMerge={this.handleMerge}
                onRemoveBookmark={this.handleRemoveBookmark}
                onSelectStatsPeriod={this.handleSelectStatsPeriod}
                onRealtimeChange={this.handleRealtimeChange}
                realtimeActive={this.state.realtimeActive}
                statsPeriod={this.state.statsPeriod}
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
        <StreamPagination
          aggList={this.state.aggList}
          pageLinks={this.state.pageLinks} />
      </div>
    );
  }
});

module.exports = Stream;
