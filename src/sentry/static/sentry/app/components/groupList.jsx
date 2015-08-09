import React from "react";
import Reflux from "reflux";
import Router from "react-router";
import jQuery from "jquery";
import api from "../api";
import GroupListHeader from "../components/groupListHeader";
import GroupStore from "../stores/groupStore";
import LoadingError from "../components/loadingError";
import LoadingIndicator from "../components/loadingIndicator";
import ProjectState from "../mixins/projectState";
import PropTypes from "../proptypes";
import StreamGroup from "../components/streamGroup";
import TimeSince from "../components/timeSince";
import utils from "../utils";

var GroupList = React.createClass({
  contextTypes: {
    router: React.PropTypes.func
  },

  propTypes: {
    query: React.PropTypes.string.isRequired,
    canSelectGroups: React.PropTypes.bool
  },

  mixins: [
    ProjectState,
    Reflux.listenTo(GroupStore, "onGroupChange"),
  ],

  getDefaultProps() {
    return {
      canSelectGroups: true
    };
  },

  getInitialState() {
    return {
      loading: true,
      error: false,
      groupIds: []
    };
  },

  shouldComponentUpdate(nextProps, nextState) {
    return !utils.valueIsEqual(this.state, nextState, true);
  },

  componentWillMount() {
    var params = this.context.router.getCurrentParams();

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
    queryParams.sort = 'new';
    queryParams.query = this.props.query;
    var querystring = jQuery.param(queryParams);

    return '/projects/' + params.orgId + '/' + params.projectId + '/groups/?' + querystring;
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

  render() {
    if (this.state.loading)
      return <LoadingIndicator />;
    else if (this.state.error)
      return <LoadingError onRetry={this.fetchData} />;
    else if (this.state.groupIds.length === 0)
      return (
        <div className="box empty-stream">
          <span className="icon icon-exclamation"></span>
          <p>There don't seem to be any events fitting the query.</p>
        </div>
      );

    var wrapperClass;

    if (!this.props.bulkActions) {
      wrapperClass = "stream-no-bulk-actions";
    }

    return (
      <div className={wrapperClass}>
        <GroupListHeader />
        <ul className="group-list">
          {this.state.groupIds.map((id) => {
            return <StreamGroup key={id} id={id} canSelect={this.props.canSelectGroups} />;
          })}
        </ul>
      </div>
    );
  }
});

export default GroupList;
