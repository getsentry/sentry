import jQuery from "jquery";
import React from "react";
import {Link} from "react-router";

import EventList from "./projectDashboard/eventList";
import ProjectState from "../mixins/projectState";
import ProjectChart from "./projectDashboard/chart";


var ProjectDashboard = React.createClass({
  mixins: [
    ProjectState
  ],

  getDefaultProps() {
    return {
      defaultStatsPeriod: "24h"
    };
  },

  getInitialState() {
    return jQuery.extend({}, {
      statsPeriod: this.props.defaultStatsPeriod
    }, this.getQueryStringState());
  },

  componentWillMount() {
    this.props.setProjectNavSection('dashboard');
  },

  componentWillReceiveProps(nextProps) {
    this.setState(this.getQueryStringState(nextProps));
  },

  getQueryStringState(props) {
    props = props || this.props;
    var currentQuery = props.location.query;
    var statsPeriod = currentQuery.statsPeriod;

    if (statsPeriod !== '1w' && statsPeriod !== '24h' && statsPeriod != '1h') {
      statsPeriod = props.defaultStatsPeriod;
    }

    return {
      statsPeriod: statsPeriod
    };
  },

  getStatsPeriodBeginTimestamp(statsPeriod) {
    let now = new Date().getTime() / 1000;
    switch (statsPeriod) {
      case '1w':
        return now - 3600 * 24 * 7;
      case '1h':
        return now - 3600;
      case '24h':
      default:
        return now - 3600 * 24;
    }
  },

  getStatsPeriodResolution(statsPeriod) {
    switch (statsPeriod) {
      case '1w':
        return '1h';
      case '1h':
        return '10s';
      case '24h':
      default:
        return '1h';
    }
  },

  getTrendingEventsEndpoint(dateSince) {
    let params = this.props.params;
    let qs = jQuery.param({
      sort: "priority",
      query: "is:unresolved",
      since: dateSince
    });
    return "/projects/" + params.orgId + "/" + params.projectId + "/groups/?" + qs;
  },

  getNewEventsEndpoint(dateSince) {
    let params = this.props.params;
    let qs = jQuery.param({
      sort: "new",
      query: "is:unresolved",
      since: dateSince
    });
    return "/projects/" + params.orgId + "/" + params.projectId + "/groups/?" + qs;
  },

  render() {
    let {statsPeriod} = this.state;
    let dateSince = this.getStatsPeriodBeginTimestamp(statsPeriod);
    let resolution = this.getStatsPeriodResolution(statsPeriod);
    let {orgId, projectId} = this.props.params;
    let url = `/${orgId}/${projectId}/dashboard/`;
    let routeQuery = this.props.location.query;

    return (
      <div>
        <div>
          <div className="pull-right">
            <div className="btn-group">
              <Link
                to={url}
                query={jQuery.extend({}, routeQuery, {statsPeriod: '1h'})}
                active={statsPeriod === '1h'}
                className={"btn btn-sm btn-default" + (statsPeriod === "1h" ? " active" : "")}>1h</Link>
              <Link
                to={url}
                query={jQuery.extend({}, routeQuery, {statsPeriod: '24h'})}
                active={statsPeriod === '24h'}
                className={"btn btn-sm btn-default" + (statsPeriod === "24h" ? " active" : "")}>24h</Link>
              <Link
                to={url}
                query={jQuery.extend({}, routeQuery, {statsPeriod: '1w'})}
                className={"btn btn-sm btn-default" + (statsPeriod === "1w" ? " active" : "")}>1w</Link>
            </div>
          </div>
          <h3>Overview</h3>
        </div>
        <ProjectChart
            dateSince={dateSince}
            resolution={resolution} />
        <div className="row">
          <div className="col-md-6">
            <EventList
                title="Trending Events"
                endpoint={this.getTrendingEventsEndpoint(dateSince)} />
          </div>
          <div className="col-md-6">
            <EventList
                title="New Events"
                endpoint={this.getNewEventsEndpoint(dateSince)} />
          </div>
        </div>
      </div>
    );
  }
});

export default ProjectDashboard;

