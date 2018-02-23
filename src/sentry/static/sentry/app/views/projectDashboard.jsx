import PropTypes from 'prop-types';
import React from 'react';
import createReactClass from 'create-react-class';
import {Link} from 'react-router';
import Reflux from 'reflux';

import LatestContextStore from '../stores/latestContextStore';
import EventList from './projectDashboard/eventList';
import ProjectState from '../mixins/projectState';
import ProjectChart from './projectDashboard/chart';
import BurnDown from './projectDashboard/burnDown';

import {t} from '../locale';

const PERIOD_HOUR = '1h';
const PERIOD_DAY = '1d';
const PERIOD_WEEK = '1w';
const PERIODS = new Set([PERIOD_HOUR, PERIOD_DAY, PERIOD_WEEK]);

const ProjectDashboard = createReactClass({
  displayName: 'ProjectDashboard',

  propTypes: {
    defaultStatsPeriod: PropTypes.string,
    setProjectNavSection: PropTypes.func,
  },

  mixins: [ProjectState, Reflux.listenTo(LatestContextStore, 'onLatestContextChange')],

  getDefaultProps() {
    return {
      defaultStatsPeriod: PERIOD_DAY,
    };
  },

  getInitialState() {
    return {
      statsPeriod: this.props.defaultStatsPeriod,
      activeEnvironment: null,
      hasEnvironmentsFeature: new Set(this.context.organization.features).has(
        'environments'
      ),
      ...this.getQueryStringState(),
    };
  },

  componentWillMount() {
    this.props.setProjectNavSection('dashboard');

    // Manually fire onLatestContextChange
    this.onLatestContextChange(LatestContextStore.getInitialState());
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
      statsPeriod,
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

  onLatestContextChange(context) {
    if (this.state.hasEnvironmentsFeature) {
      this.setState({
        activeEnvironment: context.environment,
      });
    }
  },

  render() {
    let {statsPeriod} = this.state;
    let dateSince = this.getStatsPeriodBeginTimestamp(statsPeriod);
    let resolution = this.getStatsPeriodResolution(statsPeriod);
    let {orgId, projectId} = this.props.params;
    let url = `/${orgId}/${projectId}/dashboard/`;
    let routeQuery = this.props.location.query;
    let now = new Date().getTime() / 1000;

    return (
      <div>
        <div>
          <div className="pull-right">
            <div className="btn-group">
              <Link
                to={{
                  pathname: url,
                  query: {...routeQuery, statsPeriod: PERIOD_HOUR},
                }}
                className={
                  'btn btn-sm btn-default' +
                  (statsPeriod === PERIOD_HOUR ? ' active' : '')
                }
              >
                {t('1 hour')}
              </Link>
              <Link
                to={{
                  pathname: url,
                  query: {...routeQuery, statsPeriod: PERIOD_DAY},
                }}
                className={
                  'btn btn-sm btn-default' + (statsPeriod === PERIOD_DAY ? ' active' : '')
                }
              >
                {t('1 day')}
              </Link>
              <Link
                to={{
                  pathname: url,
                  query: {...routeQuery, statsPeriod: PERIOD_WEEK},
                }}
                className={
                  'btn btn-sm btn-default' +
                  (statsPeriod === PERIOD_WEEK ? ' active' : '')
                }
              >
                {t('1 week')}
              </Link>
            </div>
          </div>
          <h3>{t('Overview')}</h3>
        </div>
        <h4>Triage Status (30 days)</h4>
        <BurnDown dateSince={now - 3600 * 24 * 30} resolution={resolution} />
        <ProjectChart dateSince={dateSince} resolution={resolution} />
        <div className="row">
          <div className="col-md-6">
            <EventList
              type="priority"
              environment={this.state.activeEnvironment}
              dateSince={dateSince}
              params={this.props.params}
            />
          </div>
          <div className="col-md-6">
            <EventList
              type="new"
              environment={this.state.activeEnvironment}
              dateSince={dateSince}
              params={this.props.params}
            />
          </div>
        </div>
      </div>
    );
  },
});

export default ProjectDashboard;
