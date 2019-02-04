import PropTypes from 'prop-types';
import React from 'react';
import createReactClass from 'create-react-class';
import {Link} from 'react-router';

import SentryTypes from 'app/sentryTypes';
import ProjectState from 'app/mixins/projectState';
import PageHeading from 'app/components/pageHeading';
import {t} from 'app/locale';
import withEnvironmentInQueryString from 'app/utils/withEnvironmentInQueryString';

import EventList from './eventList';
import ProjectChart from './chart';

const PERIOD_HOUR = '1h';
const PERIOD_DAY = '1d';
const PERIOD_WEEK = '1w';
const PERIODS = new Set([PERIOD_HOUR, PERIOD_DAY, PERIOD_WEEK]);

const ProjectDashboard = createReactClass({
  displayName: 'ProjectDashboard',

  propTypes: {
    defaultStatsPeriod: PropTypes.string,
    setProjectNavSection: PropTypes.func,
    environment: SentryTypes.Environment,
  },

  mixins: [ProjectState],

  getDefaultProps() {
    return {
      defaultStatsPeriod: PERIOD_DAY,
    };
  },

  getInitialState() {
    return {
      statsPeriod: this.props.defaultStatsPeriod,
      ...this.getQueryStringState(),
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
    const currentQuery = props.location.query;
    let statsPeriod = currentQuery.statsPeriod;

    if (!PERIODS.has(statsPeriod)) {
      statsPeriod = props.defaultStatsPeriod;
    }

    return {
      statsPeriod,
    };
  },

  getStatsPeriodBeginTimestamp(statsPeriod) {
    const now = new Date().getTime() / 1000;
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

  render() {
    const {statsPeriod} = this.state;
    const dateSince = this.getStatsPeriodBeginTimestamp(statsPeriod);
    const resolution = this.getStatsPeriodResolution(statsPeriod);
    const {orgId, projectId} = this.props.params;
    const url = `/${orgId}/${projectId}/dashboard/`;
    const routeQuery = this.props.location.query;

    return (
      <div>
        <div className="row" style={{marginBottom: '5px'}}>
          <div className="col-sm-9">
            <PageHeading withMargins>{t('Overview')}</PageHeading>
          </div>
          <div className="col-sm-3" style={{textAlign: 'right', marginTop: '4px'}}>
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
        </div>
        <ProjectChart
          dateSince={dateSince}
          resolution={resolution}
          environment={this.props.environment}
        />
        <div className="row">
          <div className="col-md-6">
            <EventList
              type="priority"
              environment={this.props.environment}
              dateSince={dateSince}
              params={this.props.params}
            />
          </div>
          <div className="col-md-6">
            <EventList
              type="new"
              environment={this.props.environment}
              dateSince={dateSince}
              params={this.props.params}
            />
          </div>
        </div>
      </div>
    );
  },
});

export default withEnvironmentInQueryString(ProjectDashboard);
