import jQuery from 'jquery';
import React from 'react';
import {Link} from 'react-router';

import EventList from './projectDashboard/eventList';
import ProjectState from '../mixins/projectState';
import ProjectChart from './projectDashboard/chart';

const PERIOD_HOUR = '1h';
const PERIOD_DAY = '1d';
const PERIOD_WEEK = '1w';
const PERIODS = new Set([PERIOD_HOUR, PERIOD_DAY, PERIOD_WEEK]);


const ProjectDashboard = React.createClass({
  mixins: [
    ProjectState
  ],

  getDefaultProps() {
    return {
      defaultStatsPeriod: PERIOD_DAY
    };
  },

  getInitialState() {
    return {
      statsPeriod: this.props.defaultStatsPeriod,
      ...this.getQueryStringState()
    };
  },

  componentWillMount() {
    this.props.setProjectNavSection('dashboard');
  },

  componentWillReceiveProps(nextProps) {
    this.setState(this.getQueryStringState(nextProps));
  },

  getQueryStringState(props) {
    props = props || this.props;
    let currentQuery = props.location.query;
    let statsPeriod = currentQuery.statsPeriod;

    if (!PERIODS.has(statsPeriod)) {
      statsPeriod = props.defaultStatsPeriod;
    }

    return {
      statsPeriod: statsPeriod
    };
  },

  getStatsPeriodBeginTimestamp(statsPeriod) {
    let now = new Date().getTime() / 1000;
    switch (statsPeriod) {
      case PERIOD_WEEK:
        return now - 3600 * 24 * 7;
      case PERIOD_HOUR:
        return now - 3600;
      case PERIOD_DAY:
      default:
        return now - 3600 * 24;
    }
  },

  getStatsPeriodResolution(statsPeriod) {
    switch (statsPeriod) {
      case PERIOD_WEEK:
        return '1h';
      case PERIOD_HOUR:
        return '10s';
      case PERIOD_DAY:
      default:
        return '1h';
    }
  },

  getTrendingEventsEndpoint(dateSince) {
    let params = this.props.params;
    let qs = jQuery.param({
      sort: 'priority',
      query: 'is:unresolved',
      since: dateSince
    });
    return '/projects/' + params.orgId + '/' + params.projectId + '/groups/?' + qs;
  },

  getNewEventsEndpoint(dateSince) {
    let params = this.props.params;
    let qs = jQuery.param({
      sort: 'new',
      query: 'is:unresolved',
      since: dateSince
    });
    return '/projects/' + params.orgId + '/' + params.projectId + '/groups/?' + qs;
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
                query={{...routeQuery, statsPeriod: PERIOD_HOUR}}
                active={statsPeriod === PERIOD_HOUR}
                className={'btn btn-sm btn-default' + (statsPeriod === PERIOD_HOUR ? ' active' : '')}>1 hour</Link>
              <Link
                to={url}
                query={{...routeQuery, statsPeriod: PERIOD_DAY}}
                active={statsPeriod === PERIOD_DAY}
                className={'btn btn-sm btn-default' + (statsPeriod === PERIOD_DAY ? ' active' : '')}>1 day</Link>
              <Link
                to={url}
                query={{...routeQuery, statsPeriod: PERIOD_WEEK}}
                className={'btn btn-sm btn-default' + (statsPeriod === PERIOD_WEEK ? ' active' : '')}>1 week</Link>
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
