import PropTypes from 'prop-types';
import React from 'react';
import Reflux from 'reflux';
import createReactClass from 'create-react-class';
import SentryTypes from 'app/sentryTypes';
import ApiMixin from 'app/mixins/apiMixin';
import EnvironmentStore from 'app/stores/environmentStore';
import LatestContextStore from 'app/stores/latestContextStore';
import LoadingIndicator from 'app/components/loadingIndicator';
import OrganizationState from 'app/mixins/organizationState';
import GroupReleaseChart from 'app/components/group/releaseChart';
import SeenInfo from 'app/components/group/seenInfo';
import {t} from 'app/locale';

const GroupReleaseStats = createReactClass({
  displayName: 'GroupReleaseStats',

  propTypes: {
    group: SentryTypes.Group.isRequired,
    project: SentryTypes.Project.isRequired,
    allEnvironments: PropTypes.object,
  },

  contextTypes: {
    organization: PropTypes.object,
  },

  mixins: [
    ApiMixin,
    OrganizationState,
    Reflux.listenTo(LatestContextStore, 'onLatestContextChange'),
  ],

  getInitialState() {
    let envList = EnvironmentStore.getActive();
    const latestEnv = LatestContextStore.getInitialState().environment;

    return {
      envList,
      environments: latestEnv ? [latestEnv] : [],
    };
  },

  getEnvironment(envName) {
    let defaultEnv = EnvironmentStore.getDefault();
    let queriedEnvironment = EnvironmentStore.getByName(envName);

    return queriedEnvironment || defaultEnv;
  },

  onLatestContextChange(context) {
    const env = context.environment;
    this.setState({environments: env ? [env] : []});
  },

  render() {
    let {group, project, allEnvironments} = this.props;
    let {environments} = this.state;

    const environmentLabel = environments.length
      ? environments.map(env => env.displayName).join(', ')
      : t('All Environments');

    const shortEnvironmentLabel =
      environments.length > 1
        ? t('selected environments')
        : environments.length === 1 ? environments[0].displayName : null;

    let projectId = project.slug;
    let orgId = this.getOrganization().slug;
    let hasRelease = new Set(project.features).has('releases');
    let isLoading = !group || !allEnvironments;

    return (
      <div className="env-stats">
        <h6>
          <span>{environmentLabel}</span>
        </h6>
        <div className="env-content">
          {isLoading ? (
            <LoadingIndicator />
          ) : (
            <div>
              <GroupReleaseChart
                group={allEnvironments}
                environment={environmentLabel}
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
                environment={environmentLabel}
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
                {environments.length ? <small>({environmentLabel})</small> : null}
              </h6>

              <SeenInfo
                orgId={orgId}
                projectId={projectId}
                date={group.firstSeen}
                dateGlobal={allEnvironments.firstSeen}
                hasRelease={hasRelease}
                environment={shortEnvironmentLabel}
                release={group.firstRelease || null}
                title={t('First seen')}
              />

              <h6>
                <span>{t('Last seen')}</span>
                {environments.length ? <small>({environmentLabel})</small> : null}
              </h6>
              <SeenInfo
                orgId={orgId}
                projectId={projectId}
                date={group.lastSeen}
                dateGlobal={allEnvironments.lastSeen}
                hasRelease={hasRelease}
                environment={shortEnvironmentLabel}
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
