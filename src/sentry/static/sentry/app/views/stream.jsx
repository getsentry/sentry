/*** @jsx React.DOM */
var React = require("react");
var Reflux = require("reflux");
var $ = require("jquery");

var api = require("../api");
var GroupActions = require("../actions/groupActions");
var GroupStore = require("../stores/groupStore");
var LoadingError = require("../components/loadingError");
var LoadingIndicator = require("../components/loadingIndicator");
var Pagination = require("../components/pagination");
var RouteMixin = require("../mixins/routeMixin");
var StreamGroup = require('./stream/group');
var StreamActions = require('./stream/actions');
var StreamFilters = require('./stream/filters');
var utils = require("../utils");

var Stream = React.createClass({
  mixins: [
    Reflux.listenTo(GroupStore, "onAggListChange"),
    RouteMixin
  ],

  contextTypes: {
    router: React.PropTypes.func
  },

  propTypes: {
    setProjectNavSection: React.PropTypes.func.isRequired
  },

  getInitialState() {
    return {
      groupIds: [],
      selectAllActive: false,
      multiSelected: false,
      anySelected: false,
      statsPeriod: '24h',
      realtimeActive: true,
      pageLinks: '',
      loading: true,
      error: false
    };
  },

  shouldComponentUpdate(nextProps, nextState) {
    return !utils.valueIsEqual(this.state, nextState, true);
  },

  componentWillMount() {
    this.props.setProjectNavSection('stream');

    this._streamManager = new utils.StreamManager(GroupStore);
    this._poller = new utils.CursorPoller({
      success: this.onRealtimePoll,
      endpoint: this.getGroupListEndpoint()
    });
    this._poller.enable();

    this.fetchData();
  },

  routeDidChange() {
    this.fetchData();
  },

  componentWillUnmount() {
    this._poller.disable();
    GroupStore.loadInitialData([]);
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

  fetchData() {
    GroupStore.loadInitialData([]);

    this.setState({
      loading: true,
      error: false
    });

    api.request(this.getGroupListEndpoint(), {
      success: (data, _, jqXHR) => {
        this._streamManager.push(data);

        this.setState({
          error: false,
          loading: false,
          pageLinks: jqXHR.getResponseHeader('Link')
        });
      },
      error: () => {
        this.setState({
          error: true,
          loading: false
        });
      },
      complete: () => {
        if (this.state.realtimeActive) {
          this._poller.enable();
        }
      }
    });
  },

  getGroupListEndpoint() {
    var router = this.context.router;
    var params = router.getCurrentParams();
    var queryParams = router.getCurrentQuery();
    queryParams.limit = 50;
    var querystring = $.param(queryParams);

    return '/projects/' + params.orgId + '/' + params.projectId + '/groups/?' + querystring;
  },

  handleRealtimeChange(event) {
    this.setState({
      realtimeActive: !this.state.realtimeActive
    });
  },

  handleSelectStatsPeriod(period) {
    if (period !== this.state.statsPeriod) {
      this.setState({
        statsPeriod: period
      });
    }
  },

  onRealtimePoll(data) {
    this._streamManager.unshift(data);
  },

  onAggListChange() {
    this.setState({
      groupIds: this._streamManager.getAllItems().map((item) => item.id)
    });
  },

  onPage(cursor) {
    var router = this.context.router;
    var params = router.getCurrentParams();
    var queryParams = router.getCurrentQuery();
    queryParams.cursor = cursor;

    this.transitionTo('stream', params, queryParams);
  },

  render() {
    var router = this.context.router;
    var params = router.getCurrentParams();
    var groupNodes = this.state.groupIds.map((id) => {
      return <StreamGroup
          key={id}
          id={id}
          statsPeriod={this.state.statsPeriod} />;
    });

    return (
      <div>
        <StreamFilters />
        <div className="group-header">
          <StreamActions
            orgId={params.orgId}
            projectId={params.projectId}
            onSelectStatsPeriod={this.handleSelectStatsPeriod}
            onRealtimeChange={this.handleRealtimeChange}
            realtimeActive={this.state.realtimeActive}
            statsPeriod={this.state.statsPeriod}
            groupIds={this.state.groupIds} />
        </div>
        {this.state.loading ?
          <LoadingIndicator />
        : (this.state.error ?
          <LoadingError onRetry={this.fetchData} />
        :
          <ul className="group-list">
            {groupNodes}
          </ul>
        )}

        <Pagination pageLinks={this.state.pageLinks} onPage={this.onPage} />
      </div>
    );
  }
});

module.exports = Stream;
