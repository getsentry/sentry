import jQuery from "jquery";
import React from "react";
import Router from "react-router";

import EventList from "./projectDashboard/eventList";
import ProjectState from "../mixins/projectState";
import ProjectChart from "./projectDashboard/chart";
import RouteMixin from "../mixins/routeMixin";


var ProjectDashboard = React.createClass({
  mixins: [
    ProjectState,
    RouteMixin
  ],

  contextTypes: {
    router: React.PropTypes.func
  },

  propTypes: {
    setProjectNavSection: React.PropTypes.func.isRequired
  },

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
    this._path = this.context.router.getCurrentPath();
  },

  routeDidChange() {
    this.setState(this.getQueryStringState());
  },

  shouldComponentUpdate(nextProps, nextState) {
    if (this._path !== this.context.router.getCurrentPath()) {
      this._path = this.context.router.getCurrentPath();
      return true;
    }
    return false;
  },

  getQueryStringState() {
    var currentQuery = this.context.router.getCurrentQuery();
    var statsPeriod = currentQuery.statsPeriod;

    if (statsPeriod !== '1w' && statsPeriod !== '24h' && statsPeriod != '1h') {
      statsPeriod = this.props.defaultStatsPeriod;
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
    let router = this.context.router;
    let params = router.getCurrentParams();
    let qs = "sort=priority&since=" + dateSince;
    return "/projects/" + params.orgId + "/" + params.projectId + "/groups/?" + qs;
  },

  getNewEventsEndpoint(dateSince) {
    let router = this.context.router;
    let params = router.getCurrentParams();
    let qs = "sort=new&since=" + dateSince;
    return "/projects/" + params.orgId + "/" + params.projectId + "/groups/?" + qs;
  },

  render() {
    let {statsPeriod} = this.state;
    let dateSince = this.getStatsPeriodBeginTimestamp(statsPeriod);
    let resolution = this.getStatsPeriodResolution(statsPeriod);
    let router = this.context.router;
    let routeName = "projectDashboard";
    let routeParams = router.getCurrentParams();
    let routeQuery = router.getCurrentQuery();

    return (
      <div>
        <div>
          <div className="pull-right">
            <div className="btn-group">
              <Router.Link
                to={routeName}
                params={routeParams}
                query={jQuery.extend({}, routeQuery, {statsPeriod: '1h'})}
                isActive={statsPeriod === '1h'}
                className={"btn btn-sm btn-default"}>1h</Router.Link>
              <Router.Link
                to={routeName}
                params={routeParams}
                query={jQuery.extend({}, routeQuery, {statsPeriod: '24h'})}
                isActive={statsPeriod === '24h'}
                className={"btn btn-sm btn-default"}>24h</Router.Link>
              <Router.Link
                to={routeName}
                params={routeParams}
                query={jQuery.extend({}, routeQuery, {statsPeriod: '1w'})}
                isActive={statsPeriod === '1w'}
                className={"btn btn-sm btn-default"}>1w</Router.Link>
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

