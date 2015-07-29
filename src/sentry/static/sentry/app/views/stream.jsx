var React = require("react");
var Reflux = require("reflux");
var $ = require("jquery");
var Cookies = require("js-cookie");

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

  getDefaultProps() {
    var dateFrom = new Date(); dateFrom.setDate(dateFrom.getDate() - 3);
    dateFrom = dateFrom.getTime() / 1000;

    return {
      defaultQuery: "is:unresolved",
      defaultStatsPeriod: "24h",
      defaultDateFrom: dateFrom,
      maxItems: 25
    };
  },

  getInitialState() {
    return {
      groupIds: [],
      selectAllActive: false,
      multiSelected: false,
      anySelected: false,
      statsPeriod: this.props.defaultStatsPeriod,
      realtimeActive: false,
      pageLinks: '',
      loading: true,
      error: false,
      query: this.props.defaultQuery,
      filter: {}
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

    var realtime = Cookies.get("realtimeActive");
    if (realtime) {
      var realtimeActive = realtime === "true";
      this.setState({
        realtimeActive: realtimeActive
      });
      if (realtimeActive) {
        this._poller.enable();
      }
    }

    this.syncStateWithRoute();
    this.fetchData();
  },

  componentWillUnmount() {
    this._poller.disable();
    GroupStore.reset();
  },

  syncStateWithRoute() {
    var currentQuery = this.context.router.getCurrentQuery();

    var filter = {};
    if (currentQuery.bookmarks) {
      filter = { bookmarks: "1" };
    } else if (currentQuery.assigned) {
      filter = { assigned: "1" };
    }

    var query = (
      currentQuery.hasOwnProperty("query") ?
      currentQuery.query :
      this.props.defaultQuery);
    var statsPeriod = (
      currentQuery.hasOwnProperty("statsPeriod") ?
      currentQuery.statsPeriod :
      this.props.defaultStatsPeriod);

    this.setState({
      filter: filter,
      query: query,
      statsPeriod: statsPeriod
    });
  },

  routeDidChange() {
    this.syncStateWithRoute();
    this._poller.disable();
    this.fetchData();
  },

  componentDidUpdate(prevProps, prevState) {
    this._poller.setEndpoint(this.getGroupListEndpoint());
    if (prevState.realtimeActive !== this.state.realtimeActive) {
      if (this.state.realtimeActive) {
        this._poller.enable();
      } else {
        this._poller.disable();
      }
    }
    var groupList = this.refs.groupList;
    if (groupList) {
      var parent = $(this.refs.groupList.getDOMNode());
      // TODO(dcramer): this code is problematic
      var groupHeight = parent.find('.group').first().outerHeight() || 94;
      parent.height(94 * parent.find('.group').length);
    }
  },

  fetchData() {
    GroupStore.loadInitialData([]);

    this.setState({
      loading: true,
      error: false
    });

    var url = this.getGroupListEndpoint();

    api.request(url, {
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
          this._poller.setEndpoint(url);
          this._poller.enable();
        }
      }
    });
  },

  getGroupListEndpoint() {
    var router = this.context.router;
    var params = router.getCurrentParams();
    var queryParams = router.getCurrentQuery();
    queryParams.limit = this.props.maxItems;
    queryParams.statsPeriod = this.state.statsPeriod;
    if (!queryParams.hasOwnProperty("since")) {
      queryParams.since = this.props.defaultDateFrom;
    }
    if (!queryParams.hasOwnProperty("query")) {
      queryParams.query = this.props.defaultQuery;
    }
    var querystring = $.param(queryParams);

    return '/projects/' + params.orgId + '/' + params.projectId + '/groups/?' + querystring;
  },

  onRealtimeChange(realtime) {
    Cookies.set("realtimeActive", realtime.toString());
    this.setState({
      realtimeActive: realtime
    });
  },

  onSelectStatsPeriod(period) {
    if (period != this.state.statsPeriod) {
      // TODO(dcramer): all charts should now suggest "loading"
      this.setState({
        statsPeriod: period
      }, function() {
        this.transitionTo();
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

  onSearch() {
    this.transitionTo();
  },

  onQueryChange(query, callback) {
    this.setState({
      query: query
    }, callback);
  },

  onFilterChange(filter) {
    this.setState({
      filter: filter
    }, function() {
      this.transitionTo();
    });
  },

  transitionTo() {
    var router = this.context.router;
    var queryParams = {};

    for (var prop in this.state.filter) {
      queryParams[prop] = this.state.filter[prop];
    }

    if (this.state.query !== this.props.defaultQuery) {
      queryParams.query = this.state.query;
    }

    if (this.state.statsPeriod !== this.props.defaultStatsPeriod) {
      queryParams.statsPeriod = this.state.statsPeriod;
    }

    router.transitionTo('stream', router.getCurrentParams(), queryParams);
  },

  renderGroupNodes(ids, statsPeriod) {
    var groupNodes = ids.map((id) => {
      return <StreamGroup key={id} id={id} statsPeriod={statsPeriod} />;
    });

    return (<ul className="group-list" ref="groupList">{groupNodes}</ul>);
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
        <StreamFilters query={this.state.query}
          defaultQuery={this.props.defaultQuery}
          onQueryChange={this.onQueryChange}
          onFilterChange={this.onFilterChange}
          onSearch={this.onSearch} />
        <div className="group-header">
          <StreamActions
            orgId={params.orgId}
            projectId={params.projectId}
            onSelectStatsPeriod={this.onSelectStatsPeriod}
            onRealtimeChange={this.onRealtimeChange}
            realtimeActive={this.state.realtimeActive}
            statsPeriod={this.state.statsPeriod}
            groupIds={this.state.groupIds}
            defaultDateFrom={this.props.defaultDateFrom} />
        </div>
        {this.renderStreamBody()}
        <Pagination pageLinks={this.state.pageLinks} onPage={this.onPage} />
      </div>
    );
  }

});

module.exports = Stream;
