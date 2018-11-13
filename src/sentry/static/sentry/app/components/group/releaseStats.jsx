import PropTypes from 'prop-types';
import React from 'react';
import Reflux from 'reflux';
import createReactClass from 'create-react-class';
import ApiMixin from 'app/mixins/apiMixin';
import EnvironmentStore from 'app/stores/environmentStore';
import LatestContextStore from 'app/stores/latestContextStore';
import LoadingIndicator from 'app/components/loadingIndicator';
import GroupState from 'app/mixins/groupState';
import GroupReleaseChart from 'app/components/group/releaseChart';
import SeenInfo from 'app/components/group/seenInfo';
import {t} from 'app/locale';

const GroupReleaseStats = createReactClass({
  displayName: 'GroupReleaseStats',

  propTypes: {
    group: PropTypes.object,
    allEnvironments: PropTypes.object,
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
      envList,
      environment: LatestContextStore.getInitialState().environment,
    };
  },

  getEnvironment(envName) {
    let defaultEnv = EnvironmentStore.getDefault();
    let queriedEnvironment = EnvironmentStore.getByName(envName);

    return queriedEnvironment || defaultEnv;
  },

  onLatestContextChange(context) {
    this.setState({environment: context.environment || null});
  },

  render() {
    let {group, allEnvironments} = this.props;
    let {environment} = this.state;

    let envName = environment ? environment.displayName : t('All Environments');
    let projectId = this.getProject().slug;
    let orgId = this.getOrganization().slug;
    let hasRelease = this.getProjectFeatures().has('releases');
    let isLoading = !group || !allEnvironments;

    return (
      <div className="env-stats">
        <h6>
          <span>{envName}</span>
        </h6>
        <div className="env-content">
          {isLoading ? (
            <LoadingIndicator />
          ) : (
            <div>
              <GroupReleaseChart
                group={allEnvironments}
                environment={envName}
                environmentStats={group.stats}
                release={group.currentRelease ? group.currentRelease.release : null}
                releaseStats={group.currentRelease ? group.currentRelease.stats : null}
                statsPeriod="24h"
                title={t('Last 24 Hours')}
                firstSeen={group.firstSeen}
                lastSeen={group.lastSeen}
              />
              <GroupReleaseChart
                group={allEnvironments}
                environment={envName}
                environmentStats={group.stats}
                release={group.currentRelease ? group.currentRelease.release : null}
                releaseStats={group.currentRelease ? group.currentRelease.stats : null}
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
                date={group.firstSeen}
                dateGlobal={allEnvironments.firstSeen}
                hasRelease={hasRelease}
                environment={environment ? environment.name : null}
                release={group.firstRelease || null}
                title={t('First seen')}
              />

              <h6>
                <span>{t('Last seen')}</span>
                {environment ? <small>({environment.displayName})</small> : null}
              </h6>
              <SeenInfo
                orgId={orgId}
                projectId={projectId}
                date={group.lastSeen}
                dateGlobal={allEnvironments.lastSeen}
                hasRelease={hasRelease}
                environment={environment ? environment.name : null}
                release={group.lastRelease || null}
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
