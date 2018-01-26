import PropTypes from 'prop-types';
import React from 'react';
import createReactClass from 'create-react-class';
import {browserHistory} from 'react-router';

import ApiMixin from '../../mixins/apiMixin';
import DropdownLink from '../dropdownLink';
import EnvironmentStore from '../../stores/environmentStore';
import LoadingIndicator from '../loadingIndicator';
import LoadingError from '../loadingError';
import GroupState from '../../mixins/groupState';
import GroupReleaseChart from './releaseChart';
import MenuItem from '../menuItem';
import SeenInfo from './seenInfo';
import {t} from '../../locale';

// TODO(dcramer): this should listen to EnvironmentStore
// changes
const GroupReleaseStats = createReactClass({
  displayName: 'GroupReleaseStats',

  propTypes: {
    group: PropTypes.object,
  },

  mixins: [ApiMixin, GroupState],

  getInitialState() {
    let envList = EnvironmentStore.getAll();
    let environmentQueryParam = this.props.location.query.environment;

    return {
      loading: true,
      error: false,
      data: null,
      envList,
      environment: this.getEnvironment(environmentQueryParam),
    };
  },

  componentWillMount() {
    if (this.state.loading) {
      this.fetchData();
    }
  },

  componentWillReceiveProps(nextProps) {
    let queryParams = nextProps.location.query;
    if (queryParams.environment !== this.props.location.query.environment) {
      this.setState(
        {
          environment: this.getEnvironment(queryParams.environment),
          loading: true,
          error: false,
        },
        this.fetchData
      );
    }
  },

  shouldComponentUpdate(nextProps, nextState) {
    return (
      this.state.loading !== nextState.loading ||
      this.state.error !== nextState.error ||
      this.state.environment !== nextState.environment ||
      this.props.group.id !== nextProps.group.id
    );
  },

  getEnvironment(envName) {
    let defaultEnv = EnvironmentStore.getDefault();
    let queriedEnvironment = EnvironmentStore.getByName(envName);
    return queriedEnvironment || defaultEnv;
  },

  fetchData() {
    let group = this.props.group;
    let env = this.state.environment || {};
    let envName = env.urlRoutingName;
    let stats = this.props.group.stats['24h'];

    // due to the current stats logic in Sentry we need to extend the bounds
    let until = stats[stats.length - 1][0] + 1;

    this.api.request(`/issues/${group.id}/environments/${envName}/`, {
      query: {
        until,
      },
      success: data => {
        this.setState({
          data,
          loading: false,
          error: false,
        });
      },
      error: () => {
        this.setState({
          data: null,
          loading: false,
          error: true,
        });
      },
    });
  },

  switchEnv(env) {
    if (this.state.environment === env) return;

    let queryParams = Object.assign({}, this.props.location.query);
    queryParams.environment = env;

    browserHistory.push({
      pathname: this.props.location.pathname,
      query: queryParams,
    });
  },

  render() {
    let group = this.props.group;
    let projectId = this.getProject().slug;
    let orgId = this.getOrganization().slug;
    let environment = this.state.environment;
    let data = this.state.data || {};
    let firstSeenEnv = data.firstSeen;
    let lastSeenEnv = data.lastSeen;

    let envList = this.state.envList;
    let hasRelease = this.getProjectFeatures().has('releases');

    return (
      <div className="env-stats">
        <h6>
          <span>
            <DropdownLink title={environment && environment.displayName}>
              {envList.map(e => {
                return (
                  <MenuItem
                    key={e.name}
                    isActive={environment.name === e.name}
                    onClick={() => this.switchEnv(e.name)}
                  >
                    {e.displayName}
                  </MenuItem>
                );
              })}
            </DropdownLink>
          </span>
        </h6>
        <div className="env-content">
          {this.state.loading ? (
            <LoadingIndicator />
          ) : this.state.error ? (
            <LoadingError />
          ) : (
            <div>
              <GroupReleaseChart
                group={group}
                environment={environment.name}
                environmentStats={data.environment.stats}
                release={data.currentRelease ? data.currentRelease.release : null}
                releaseStats={data.currentRelease ? data.currentRelease.stats : null}
                statsPeriod="24h"
                title={t('Last 24 Hours')}
                firstSeen={group.firstSeen}
                lastSeen={group.lastSeen}
              />

              <GroupReleaseChart
                group={group}
                environment={environment.name}
                environmentStats={data.environment.stats}
                release={data.currentRelease ? data.currentRelease.release : null}
                releaseStats={data.currentRelease ? data.currentRelease.stats : null}
                statsPeriod="30d"
                title={t('Last 30 Days')}
                className="bar-chart-small"
                firstSeen={group.firstSeen}
                lastSeen={group.lastSeen}
              />

              <h6>
                <span>{t('First seen')}</span>
                {environment.name && <small>({environment.name})</small>}
              </h6>

              <SeenInfo
                orgId={orgId}
                projectId={projectId}
                date={firstSeenEnv}
                dateGlobal={group.firstSeen}
                hasRelease={hasRelease}
                environment={environment.name}
                release={data.firstRelease ? data.firstRelease.release : null}
                title={t('First seen')}
              />

              <h6>
                <span>{t('Last seen')}</span>
                {environment.name && <small>({environment.name})</small>}
              </h6>
              <SeenInfo
                orgId={orgId}
                projectId={projectId}
                date={lastSeenEnv}
                dateGlobal={group.lastSeen}
                hasRelease={hasRelease}
                environment={environment.name}
                release={data.lastRelease ? data.lastRelease.release : null}
                title={t('Last seen')}
              />
            </div>
          )}
        </div>
      </div>
    );
  },
});

export default GroupReleaseStats;
