import React from "react";
import Router from "react-router";
import api from "../api";

import RouteMixin from "../mixins/routeMixin";
import GroupState from "../mixins/groupState";
import ApiMixin from "../mixins/apiMixin";

import EventEntries from "../components/events/eventEntries";
import GroupSidebar from "../components/group/sidebar";
import LoadingError from "../components/loadingError";
import LoadingIndicator from "../components/loadingIndicator";

var GroupOverview = React.createClass({
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
    var url = '/groups/' + this.getGroup().id + '/events/latest/';

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
    var orgId = this.getOrganization().slug;
    var projectId = this.getProject().slug;

    return (
      <div>
        <div className="row group-overview">
          <div className="col-md-9">
            {this.state.loading ?
              <LoadingIndicator />
            : (this.state.error ?
              <LoadingError onRetry={this.fetchData} />
            :
              <div>
                <div className="alert alert-block">

                    <div className="pull-right">
                    <Router.Link to="groupEventDetails"
                    params={{
                      projectId: projectId,
                      orgId: orgId,
                      groupId: group.id,
                      eventId: evt.id
                    }}>More Details</Router.Link>
                    </div>
                    This summary is based on the most recent event in this aggregate.
                </div>
                <EventEntries group={group} event={evt} />
              </div>
            )}
          </div>
          <div className="col-md-3">
            <GroupSidebar group={group} />
          </div>
        </div>
      </div>
    );
  }
});

export default GroupOverview;
