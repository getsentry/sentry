import React from "react";
import Reflux from "reflux";
import jQuery from "jquery";
import Cookies from "js-cookie";
import api from "../api";
import EventRow from "../components/events/eventRow";
import EventActions from "./projectEvents/actions";
import EventStore from "../stores/eventStore";
import LoadingError from "../components/loadingError";
import LoadingIndicator from "../components/loadingIndicator";
import Pagination from "../components/pagination";
import RouteMixin from "../mixins/routeMixin";
import utils from "../utils";

var ProjectEvents = React.createClass({
  mixins: [
    Reflux.listenTo(EventStore, "onEventChange"),
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
      eventIds: [],
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
    this.props.setProjectNavSection('events');

    this._streamManager = new utils.StreamManager(EventStore);
    this._poller = new utils.CursorPoller({
      success: this.onRealtimePoll,
      endpoint: this.getEventListEndpoint()
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

    this.fetchData();
  },

  componentWillUnmount() {
    this._poller.disable();
    EventStore.reset();
  },

  routeDidChange() {
    this._poller.disable();
    this.fetchData();
  },

  componentDidUpdate(prevProps, prevState) {
    this._poller.setEndpoint(this.getEventListEndpoint());
    if (prevState.realtimeActive !== this.state.realtimeActive) {
      if (this.state.realtimeActive) {
        this._poller.enable();
      } else {
        this._poller.disable();
      }
    }
  },

  fetchData() {
    EventStore.loadInitialData([]);

    this.setState({
      loading: true,
      error: false
    });

    var url = this.getEventListEndpoint();

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

  getEventListEndpoint() {
    var router = this.context.router;
    var params = router.getCurrentParams();
    var queryParams = router.getCurrentQuery();
    queryParams.limit = 50;
    var querystring = jQuery.param(queryParams);

    return '/projects/' + params.orgId + '/' + params.projectId + '/events/?' + querystring;
  },

  onRealtimeChange(realtime) {
    Cookies.set("realtimeActive", realtime.toString());
    this.setState({
      realtimeActive: realtime
    });
  },

  onRealtimePoll(data, links) {
    this._streamManager.unshift(data);
    if (!utils.valueIsEqual(this.state.pageLinks, links, true)) {
      this.setState({
        pageLinks: links,
      });
    }
  },

  onEventChange() {
    var eventIds = this._streamManager.getAllItems().map((item) => item.id);
    if (!utils.valueIsEqual(eventIds, this.state.eventIds)) {
      this.setState({
        eventIds: eventIds
      });
    }
  },

  onPage(cursor) {
    var router = this.context.router;
    var params = router.getCurrentParams();
    var queryParams = jQuery.extend({}, router.getCurrentQuery(), {
      cursor: cursor
    });

    router.transitionTo('events', params, queryParams);
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

  renderEventNodes(ids) {
    var params = this.context.router.getCurrentParams();
    var nodes = ids.map((id) => {
      return (
        <EventRow key={id} id={id} orgSlug={params.orgId}
            projectSlug={params.projectId} />
      );
    });

    return <table className="event-list">{nodes}</table>;
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

  renderBody() {
    var body;

    if (this.state.loading) {
      body = this.renderLoading();
    } else if (this.state.error) {
      body = (<LoadingError onRetry={this.fetchData} />);
    } else if (this.state.eventIds.length > 0) {
      body = this.renderEventNodes(this.state.eventIds);
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
        <div className="group-header">
          <EventActions
            orgId={params.orgId}
            projectId={params.projectId}
            onRealtimeChange={this.onRealtimeChange}
            realtimeActive={this.state.realtimeActive}
            eventIds={this.state.eventIds} />
        </div>
        {this.renderBody()}
        <Pagination pageLinks={this.state.pageLinks} onPage={this.onPage} />
      </div>
    );
  }
});

export default ProjectEvents;
