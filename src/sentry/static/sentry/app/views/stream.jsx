/*** @jsx React.DOM */
var React = require("react");
var Reflux = require("reflux");
var Router = require("react-router");
var $ = require("jquery");

var api = require("../api");
var AggregateListActions = require("../actions/aggregateListActions");
var AggregateListStore = require("../stores/aggregateListStore");
var StreamAggregate = require('./stream/aggregate');
var StreamActions = require('./stream/actions');
var StreamFilters = require('./stream/filters');
var StreamPagination = require('./stream/pagination');
var utils = require("../utils");

// TODO(dcramer): the poller/collection needs to actually unshift/pop
// items from the AggregateListStore to ensure it doesnt grow in memory
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
    success: (data, _, jqXHR) => {
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
    },
    complete: () => {
      if (this._active) {
        this._timeoutId = window.setTimeout(this.poll.bind(this), this._delay);
      }
    }
  });
};

var Stream = React.createClass({
  mixins: [
    Reflux.listenTo(AggregateListStore, "onAggListChange"),
    Router.State
  ],

  propTypes: {
    memberList: React.PropTypes.instanceOf(Array).isRequired
  },

  onAggListChange() {
    this.setState({
      aggList: AggregateListStore.getAllItems()
    });
  },

  getInitialState() {
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

  componentWillMount() {
    this._poller = new StreamPoller({
      success: this.handleRealtimePoll,
      endpoint: this.getAggregateListEndpoint()
    });

    api.request(this.getAggregateListEndpoint(), {
      success: (data, _, jqXHR) => {
        AggregateListStore.loadInitialData(data);

        this.setState({
          pageLinks: jqXHR.getResponseHeader('Link')
        });
      },
      complete: () => {
        if (this.state.realtimeActive) {
          this._poller.enable();
        }
      }
    });
  },

  componentWillUnmount() {
    this._poller.disable();
  },

  componentDidUpdate(prevProps, prevState) {
    if (prevState.realtimeActive !== this.state.realtimeActive) {
      if (this.state.realtimeActive) {
        this._poller.enable();
      } else {
        this._poller.disable();
      }
    }
  },

  getAggregateListEndpoint() {
    var queryParams = utils.getQueryParams();
    if (queryParams.query === undefined) {
      queryParams.query = this.state.query;
    }
    var querystring = $.param(queryParams);
    var params = this.getParams();

    return '/projects/' + params.orgId + '/' + params.projectId + '/groups/?' + querystring;
  },
  handleRealtimeChange(event) {
    this.setState({
      realtimeActive: !this.state.realtimeActive
    });
  },
  handleSelectStatsPeriod(period) {
    this.setState({
      statsPeriod: period
    });
  },
  handleQueryChange(value, event) {
    this.setState({
      query: value
    });
  },
  handleRealtimePoll(data) {
    this.setState({
      aggList: this.state.aggList.unshift(data)
    });
  },
  render() {
    var aggNodes = this.state.aggList.map((node) => {
      return <StreamAggregate
          key={node.id}
          data={node}
          memberList={this.props.memberList}
          statsPeriod={this.state.statsPeriod} />;
    });

    return (
      <div>
        <StreamFilters query={this.state.query} onQueryChange={this.handleQueryChange} />
        <div className="group-header-container" data-spy="affix" data-offset-top="134">
          <div className="container">
            <div className="group-header">
              <StreamActions
                onResolve={this.handleResolve}
                onBookmark={this.handleBookmark}
                onDelete={this.handleDelete}
                onMerge={this.handleMerge}
                onRemoveBookmark={this.handleRemoveBookmark}
                onSelectStatsPeriod={this.handleSelectStatsPeriod}
                onRealtimeChange={this.handleRealtimeChange}
                realtimeActive={this.state.realtimeActive}
                statsPeriod={this.state.statsPeriod}
                aggList={this.state.aggList} />
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
