import PropTypes from 'prop-types';
import React from 'react';
import Reflux from 'reflux';
import createReactClass from 'create-react-class';
import {get as getPath} from 'lodash';

import ApiMixin from 'app/mixins/apiMixin';
import DropdownLink from 'app/components/dropdownLink';
import {setActiveEnvironment} from 'app/actionCreators/environments';
import EnvironmentStore from 'app/stores/environmentStore';
import LatestContextStore from 'app/stores/latestContextStore';
import LoadingIndicator from 'app/components/loadingIndicator';
import LoadingError from 'app/components/loadingError';
import GroupState from 'app/mixins/groupState';
import GroupReleaseChart from 'app/components/group/releaseChart';
import MenuItem from 'app/components/menuItem';
import SeenInfo from 'app/components/group/seenInfo';
import {t} from 'app/locale';

const GroupReleaseStats = createReactClass({
  displayName: 'GroupReleaseStats',

  propTypes: {
    group: PropTypes.object,
  },

  contextTypes: {
    organization: PropTypes.object,
  },

  mixins: [
    ApiMixin,
    GroupState,
    Reflux.listenTo(LatestContextStore, 'onLatestContextChange'),
  ],

  getInitialState() {
    let envList = EnvironmentStore.getActive();

    return {
      loading: true,
      error: false,
      data: {environment: {}},
      envList,
      environment: LatestContextStore.getInitialState().environment,
      hasEnvironmentsFeature: new Set(this.context.organization.features).has(
        'environments'
      ),
    };
  },

  componentWillMount() {
    this.fetchData();
  },

  shouldComponentUpdate(nextProps, nextState) {
    return (
      this.state.loading !== nextState.loading ||
      this.state.error !== nextState.error ||
      this.state.environment !== nextState.environment ||
      this.props.group.id !== nextProps.group.id ||
      this.state.data !== nextState.data
    );
  },

  getEnvironment(envName) {
    let defaultEnv = EnvironmentStore.getDefault();
    let queriedEnvironment = EnvironmentStore.getByName(envName);

    return queriedEnvironment || defaultEnv;
  },

  onLatestContextChange(context) {
    this.setState({environment: context.environment || null}, this.fetchData);
  },

  fetchData() {
    if (this.state.environment) {
      this.fetchEnvironmentData();
    } else {
      this.fetchAllEnvironmentsData();
    }
  },

  fetchEnvironmentData() {
    // due to the current stats logic in Sentry we need to extend the bounds
    let group = this.props.group;
    let env = this.state.environment;

    let stats = group.stats['24h'];
    let until = stats[stats.length - 1][0] + 1;

    // TODO(lyn): We might not need to make this request anymore since the group
    // endpoint now accepts the environment parameter
    this.api.request(`/issues/${group.id}/environments/${env.urlRoutingName}/`, {
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

  fetchAllEnvironmentsData() {
    let group = this.props.group;

    // Grab data for all environments and set on state, following the format of /issues/group/environments/{envname}
    let data = {
      environment: {stats: group.stats},
    };

    if (group.firstRelease) {
      data.firstRelease = {
        release: group.firstRelease,
        environment: getPath(group, 'firstRelease.lastDeploy.environment'),
      };
    }

    if (group.lastRelease) {
      data.lastRelease = {
        release: group.lastRelease,
        environment: getPath(group, 'lastDeploy.lastDeploy.environment'),
      };
    }

    data.firstSeen = group.firstSeen;
    data.lastSeen = group.lastSeen;

    this.setState({
      data,
      loading: false,
    });
  },

  render() {
    let group = this.props.group;
    let {environment, data, hasEnvironmentsFeature} = this.state;

    let envList = this.state.envList || [];

    let envName = environment ? environment.displayName : t('All Environments');

    let projectId = this.getProject().slug;
    let orgId = this.getOrganization().slug;
    let hasRelease = this.getProjectFeatures().has('releases');

    return (
      <div className="env-stats">
        <h6>
          <span>
            {hasEnvironmentsFeature ? (
              envName
            ) : (
              <DropdownLink title={envName}>
                <MenuItem
                  isActive={environment === null}
                  onClick={() => setActiveEnvironment(null)}
                >
                  {t('All Environments')}
                </MenuItem>
                {envList.map(env => {
                  return (
                    <MenuItem
                      key={env.name}
                      isActive={env.name === envName}
                      onClick={() => setActiveEnvironment(env)}
                    >
                      {env.displayName}
                    </MenuItem>
                  );
                })}
              </DropdownLink>
            )}
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
                environment={envName}
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
                environment={envName}
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
                {environment ? <small>({environment.displayName})</small> : null}
              </h6>

              <SeenInfo
                orgId={orgId}
                projectId={projectId}
                date={data.firstSeen}
                dateGlobal={group.firstSeen}
                hasRelease={hasRelease}
                environment={environment ? environment.name : null}
                release={data.firstRelease ? data.firstRelease.release : null}
                title={t('First seen')}
              />

              <h6>
                <span>{t('Last seen')}</span>
                {environment ? <small>({environment.displayName})</small> : null}
              </h6>
              <SeenInfo
                orgId={orgId}
                projectId={projectId}
                date={data.lastSeen}
                dateGlobal={group.lastSeen}
                hasRelease={hasRelease}
                environment={environment ? environment.name : null}
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
