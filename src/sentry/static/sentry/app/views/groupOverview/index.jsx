import React from "react";
import Router from "react-router";
import api from "../../api";

import RouteMixin from "../../mixins/routeMixin";
import GroupState from "../../mixins/groupState";
import ApiMixin from "../../mixins/apiMixin";

import GroupChart from "../groupDetails/chart";
import GroupEventEntries from "../../components/events/eventEntries";
import LoadingError from "../../components/loadingError";
import LoadingIndicator from "../../components/loadingIndicator";
import SeenInfo from "./seenInfo";
import TagDistributionMeter from "./tagDistributionMeter";

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

    var tagList = [];
    for (var key in group.tags) {
      tagList.push([group.tags[key].name, key]);
    }
    tagList.sort();

    return (
      <div>
        <div className="row group-overview">
          <div className="col-md-3 group-stats-column">
            <div className="group-stats">
              <GroupChart statsPeriod="24h" group={group}
                          title="Last 24 Hours"
                          firstSeen={group.firstSeen}
                          lastSeen={group.lastSeen} />
              <GroupChart statsPeriod="30d" group={group}
                          title="Last 30 Days"
                          className="bar-chart-small"
                          firstSeen={group.firstSeen}
                          lastSeen={group.lastSeen} />

              <h6 className="first-seen"><span>First seen</span></h6>
              <SeenInfo
                  orgId={orgId}
                  projectId={projectId}
                  date={group.firstSeen}
                  release={group.firstRelease} />

              <h6 className="last-seen"><span>Last seen</span></h6>
              <SeenInfo
                  orgId={orgId}
                  projectId={projectId}
                  date={group.lastSeen}
                  release={group.lastRelease} />

              <h6><span>Tags</span></h6>
              {tagList.map((data) => {
                return (
                  <TagDistributionMeter
                    group={group}
                    name={data[0]}
                    tag={data[1]} />
                );
              })}
            </div>
          </div>
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
                <GroupEventEntries
                    group={group}
                    event={evt} />
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }
});

export default GroupOverview;
