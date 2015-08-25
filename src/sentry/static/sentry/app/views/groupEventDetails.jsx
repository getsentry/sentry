import React from "react";
import Router from "react-router";
import api from "../api";
import ApiMixin from "../mixins/apiMixin";
import GroupChart from "./groupDetails/chart";
import GroupEvent from "./groupDetails/event";
import GroupEventToolbar from "./groupDetails/eventToolbar";
import GroupState from "../mixins/groupState";
import MutedBox from "../components/mutedBox";
import LoadingError from "../components/loadingError";
import LoadingIndicator from "../components/loadingIndicator";
import PropTypes from "../proptypes";
import RouteMixin from "../mixins/routeMixin";
import TimeSince from "../components/timeSince";
import utils from "../utils";


var GroupEventDetails = React.createClass({
  contextTypes: {
    router: React.PropTypes.func
  },

  mixins: [
    ApiMixin,
    GroupState,
    RouteMixin
  ],

  getInitialState() {
    return {
      loading: true,
      error: false,
      event: null,
      eventNavLinks: ''
    };
  },

  componentWillMount() {
    this.fetchData();
  },

  routeDidChange(prevPath) {
    this.fetchData();
  },

  fetchData() {
    var eventId = this.context.router.getCurrentParams().eventId || 'latest';

    var url = (eventId === 'latest' ?
      '/groups/' + this.getGroup().id + '/events/' + eventId + '/' :
      '/events/' + eventId + '/');

    this.setState({
      loading: true,
      error: false
    });

    this.apiRequest(url, {
      success: (data, _, jqXHR) => {
        this.setState({
          event: data,
          error: false,
          loading: false
        });

        api.bulkUpdate({
          orgId: this.getOrganization().slug,
          projectId: this.getProject().slug,
          itemIds: [this.getGroup().id],
          failSilently: true,
          data: {hasSeen: true}
        });
      },
      error: () => {
        this.setState({
          error: true,
          loading: false
        });
      }
    });
  },

  render() {
    var group = this.getGroup();
    var evt = this.state.event;
    var params = this.context.router.getCurrentParams();

    return (
      <div>
        <MutedBox status={group.status} />
        {evt &&
          <GroupEventToolbar
              group={group}
              event={evt}
              orgId={params.orgId}
              projectId={params.projectId} />
        }
        {this.state.loading ?
          <LoadingIndicator />
        : (this.state.error ?
          <LoadingError onRetry={this.fetchData} />
        :
          <GroupEvent group={group} event={evt} />
        )}
      </div>
    );
  }
});

export default GroupEventDetails;

