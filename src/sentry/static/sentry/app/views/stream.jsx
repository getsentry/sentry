/*** @jsx React.DOM */
var React = require("react");
var Reflux = require("reflux");
var $ = require("jquery");

var api = require("../api");
var GroupActions = require("../actions/groupActions");
var GroupListStore = require("../stores/groupStore");
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
    Reflux.listenTo(GroupListStore, "onAggListChange"),
    RouteMixin
  ],

  contextTypes: {
    router: React.PropTypes.func
  },

  propTypes: {
    memberList: React.PropTypes.instanceOf(Array).isRequired,
    setProjectNavSection: React.PropTypes.func.isRequired
  },

  getInitialState() {
    return {
      groupList: [],
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
    var curState = this.state;
    var keys = ['selectAllActive', 'multiSelected', 'anySelected', 'statsPeriod',
                'realtimeActive', 'pageLinks', 'loading', 'error'];
    for (var i = 0; i < keys.length; i++) {
      if (curState[keys[i]] !== nextState[keys[i]]) {
        return true;
      }
    }
    if (curState.groupList.length != nextState.groupList.length) {
      return true;
    }
    var equal = utils.compareArrays(curState.groupList, nextState.groupList, (obj, other) => {
      return obj.id === other.id;
    });
    return !equal;
  },

  componentWillMount() {
    this.props.setProjectNavSection('stream');

    this._streamManager = new utils.StreamManager(GroupListStore);
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
    GroupListStore.loadInitialData([]);

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
      groupList: this._streamManager.getAllItems()
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
    var groupNodes = this.state.groupList.map((node) => {
      return <StreamGroup
          key={node.id}
          id={node.id}
          memberList={this.props.memberList}
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
            groupList={this.state.groupList} />
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
