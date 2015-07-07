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
var StreamGroup = require('../components/streamGroup');
var StreamActions = require('./stream/actions');
var StreamFilters = require('./stream/filters');
var utils = require("../utils");

var Stream = React.createClass({
  mixins: [
    Reflux.listenTo(GroupStore, "onGroupChange"),
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
    this._poller.disable();
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

  onRealtimePoll(data, links) {
    this._streamManager.unshift(data);
    if (!utils.valueIsEqual(this.state.pageLinks, links, true)) {
      this.setState({
        pageLinks: links,
      });
    }
  },

  onGroupChange() {
    var groupIds = this._streamManager.getAllItems().map((item) => item.id);
    if (!utils.valueIsEqual(groupIds, this.state.groupIds)) {
      this.setState({
        groupIds: groupIds
      });
    }
  },

  onPage(cursor) {
    var router = this.context.router;
    var params = router.getCurrentParams();
    var queryParams = router.getCurrentQuery();
    queryParams.cursor = cursor;

    router.transitionTo('stream', params, queryParams);
  },

  renderGroupNodes(ids, statsPeriod) {
    var groupNodes = ids.map((id) => {
      return <StreamGroup key={id} id={id} statsPeriod={statsPeriod} />;
    });

    return (<ul className="group-list">{groupNodes}</ul>);
  },

  renderEmpty() {
    return (
      <div className="box empty-stream">
        <span className="icon icon-exclamation"></span>
        <p>Sorry, no events match your filters.</p>
      </div>
    );
  },

  renderLoading() {
    return (
      <div className="box">
        <LoadingIndicator />
      </div>
    );
  },

  renderStreamBody() {
    var body;

    if (this.state.loading) {
      body = this.renderLoading();
    } else if (this.state.error) {
      body = (<LoadingError onRetry={this.fetchData} />);
    } else if (this.state.groupIds.length > 0) {
      body = this.renderGroupNodes(this.state.groupIds, this.state.statsPeriod);
    } else {
      body = this.renderEmpty();
    }

    return body;
  },

  render() {
    var router = this.context.router;
    var params = router.getCurrentParams();

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
        {this.renderStreamBody()}
        <Pagination pageLinks={this.state.pageLinks} onPage={this.onPage} />
      </div>
    );
  }
});

module.exports = Stream;
