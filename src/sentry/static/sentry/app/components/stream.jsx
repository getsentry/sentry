/*** @jsx React.DOM */
var React = require("react");
var Reflux = require("reflux");
var Router = require("react-router");
var $ = require("jquery");

var api = require("../api");
var AggregateListActions = require("../actions/aggregateListActions");
var AggregateListStore = require("../stores/aggregateListStore");
var AlertActions = require("../actions/alertActions");
var StreamAggregate = require('./stream/aggregate');
var StreamActions = require('./stream/actions');
var StreamFilters = require('./stream/filters');
var StreamPagination = require('./stream/pagination');
var utils = require("../utils");

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
  api.request(this._pollingEndpoint, {
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
  mixins: [
    Reflux.connect(AggregateListStore, "aggList"),
    Router.State
  ],

  propTypes: {
    memberList: React.PropTypes.instanceOf(Array).isRequired
  },

  getInitialState: function() {
    var queryParams = utils.getQueryParams();
    var query = queryParams.query === undefined ? 'is:unresolved': queryParams.query;

    return {
      aggList: new utils.Collection([], {
        limit: 50
      }),
      selectAllActive: false,
      multiSelected: false,
      anySelected: false,
      statsPeriod: '24h',
      realtimeActive: false,
      pageLinks: '',
      query: query
    };
  },

  componentWillMount: function() {
    this._poller = new StreamPoller({
      success: this.handleRealtimePoll,
      endpoint: this.getAggregateListEndpoint()
    });

    api.request(this.getAggregateListEndpoint(), {
      success: function(data, textStatus, jqXHR) {
        AggregateListStore.loadInitialData(data);

        this.setState({
          pageLinks: jqXHR.getResponseHeader('Link')
        });
      }.bind(this),
      complete: function() {
        if (this.state.realtimeActive) {
          this._poller.enable();
        }
      }.bind(this)
    });
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

  getAggregateListEndpoint: function() {
    var queryParams = utils.getQueryParams();
    if (queryParams.query === undefined) {
      queryParams.query = this.state.query;
    }
    var querystring = $.param(queryParams);
    var params = this.getParams();

    return '/projects/' + params.orgId + '/' + params.projectId + '/groups/?' + querystring;
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
    var params = this.getParams();
    var url = options.url || '/api/0/projects/' + params.orgId + '/' + params.projectId + '/groups/';

    var selectedAggList;
    if (aggList === StreamActions.SELECTED) {
      selectedAggList = [];
      for (var i = 0, node; (node = this.state.aggList[i]); i++) {
        if (node.isSelected === true) {
          selectedAggList.push(node);
        }
      }
      url += '?id=' + selectedAggList.map(function(node){ return node.id; }).join('&id=');
    } else {
      selectedAggList = this.state.aggList;
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
      aggList = this.state.aggList;
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
      aggList: this.state.aggList,
      selectAllActive: false,
      anySelected: false,
      multiSelected: false
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
        AlertActions.addAlert('The selected events have been scheduled for deletion.', 'success');
      }
    });
  },
  handleMerge: function(aggList, event) {
    return this.actionAggregates(aggList, {
      data: {merge: 1},
      success: function() {
        AlertActions.addAlert('The selected events have been scheduled for merge.', 'success');
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
        <StreamAggregate
            key={node.id}
            data={node}
            isSelected={node.isSelected}
            memberList={this.props.memberList}
            onSelect={this.handleSelect.bind(this, node.id)}
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
