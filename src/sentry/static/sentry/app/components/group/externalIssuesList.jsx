import React from 'react';
import PropTypes from 'prop-types';

import withApi from 'app/utils/withApi';
import AsyncComponent from 'app/components/asyncComponent';
import ExternalIssueActions, {
  SentryAppExternalIssueActions,
} from 'app/components/group/externalIssueActions';
import IssueSyncListElement from 'app/components/issueSyncListElement';
import AlertLink from 'app/components/alertLink';
import SentryTypes from 'app/sentryTypes';
import PluginActions from 'app/components/group/pluginActions';
import {Box} from 'grid-emotion';
import {t} from 'app/locale';
import SentryAppInstallationStore from 'app/stores/sentryAppInstallationsStore';
import ExternalIssueStore from 'app/stores/externalIssueStore';

class ExternalIssueList extends AsyncComponent {
  static propTypes = {
    api: PropTypes.object.isRequired,
    group: SentryTypes.Group.isRequired,
    project: SentryTypes.Project.isRequired,
    orgId: PropTypes.string,
  };

  getEndpoints() {
    const {group} = this.props;
    return [['integrations', `/groups/${group.id}/integrations/`]];
  }

  constructor(props) {
    super(props);
    this.unsubscribables = [];
    this.state = {
      components: [],
      sentryAppInstallations: [],
      externalIssues: [],
    };
  }

  componentWillMount() {
    super.componentWillMount();

    this.unsubscribables = [
      SentryAppInstallationStore.listen(this.onSentryAppInstallationChange),
      ExternalIssueStore.listen(this.onExternalIssueChange),
    ];

    this.fetchSentryAppData();
  }

  componentWillUnmount() {
    this.unsubscribables.forEach(u => u.unsubscribe());
  }

  onSentryAppInstallationChange = sentryAppInstallations => {
    this.setState({sentryAppInstallations});
  };

  onExternalIssueChange = externalIssues => {
    this.setState({externalIssues});
  };

  // We want to do this explicitly so that we can handle errors gracefully,
  // instead of the entire component not rendering.
  //
  // Part of the API request here is fetching data from the Sentry App, so
  // we need to be more conservative about error cases since we don't have
  // control over those services.
  //
  fetchSentryAppData() {
    const {api, orgId, group, project} = this.props;

    api
      .requestPromise(
        `/organizations/${orgId}/sentry-app-components/?filter=issue-link&projectId=${project.id}`
      )
      .then(data => {
        this.setState({components: data});
      })
      .catch(error => {
        return;
      });

    api
      .requestPromise(`/groups/${group.id}/external-issues/`)
      .then(data => {
        ExternalIssueStore.load(data);
        this.setState({externalIssues: data});
      })
      .catch(error => {
        return;
      });
  }

  renderIntegrationIssues(integrations = []) {
    const {group} = this.props;

    const activeIntegrations = integrations.filter(
      integration => integration.status === 'active'
    );

    return activeIntegrations.length
      ? activeIntegrations.map(integration => (
          <ExternalIssueActions
            key={integration.id}
            integration={integration}
            group={group}
          />
        ))
      : null;
  }

  renderSentryAppIssues() {
    const {externalIssues, sentryAppInstallations, components} = this.state;
    const {group} = this.props;
    const issueLinkComponents = components.filter(c => c.type === 'issue-link');

    if (issueLinkComponents.length == 0) {
      return null;
    }

    return issueLinkComponents.map(component => {
      const {sentryApp} = component;
      const installation = sentryAppInstallations.find(
        i => i.sentryApp.uuid === sentryApp.uuid
      );
      const issue = (externalIssues || []).find(i => i.serviceType == sentryApp.slug);

      return (
        <SentryAppExternalIssueActions
          key={sentryApp.slug}
          group={group}
          sentryAppComponent={component}
          sentryAppInstallation={installation}
          externalIssue={issue}
        />
      );
    });
  }

  renderPluginIssues() {
    const {group, project} = this.props;

    return group.pluginIssues && group.pluginIssues.length
      ? group.pluginIssues.map((plugin, i) => {
          return (
            <PluginActions group={group} project={project} plugin={plugin} key={i} />
          );
        })
      : null;
  }

  renderPluginActions() {
    const {group} = this.props;

    return group.pluginActions && group.pluginActions.length
      ? group.pluginActions.map((plugin, i) => {
          return (
            <IssueSyncListElement externalIssueLink={plugin[1]} key={i}>
              {plugin[0]}
            </IssueSyncListElement>
          );
        })
      : null;
  }

  renderBody() {
    const sentryAppIssues = this.renderSentryAppIssues();
    const integrationIssues = this.renderIntegrationIssues(this.state.integrations);
    const pluginIssues = this.renderPluginIssues();
    const pluginActions = this.renderPluginActions();

    if (!sentryAppIssues && !integrationIssues && !pluginIssues && !pluginActions) {
      return (
        <React.Fragment>
          <h6 data-test-id="linked-issues">
            <span>Linked Issues</span>
          </h6>
          <AlertLink
            icon="icon-generic-box"
            priority="default"
            size="small"
            to={`/settings/${this.props.orgId}/integrations`}
          >
            {t('Set up Issue Tracking')}
          </AlertLink>
        </React.Fragment>
      );
    }

    return (
      <React.Fragment>
        <h6 data-test-id="linked-issues">
          <span>Linked Issues</span>
        </h6>
        {sentryAppIssues && <Box mb={2}>{sentryAppIssues}</Box>}
        {integrationIssues && <Box mb={2}>{integrationIssues}</Box>}
        {pluginIssues && <Box mb={2}>{pluginIssues}</Box>}
        {pluginActions && <Box mb={2}>{pluginActions}</Box>}
      </React.Fragment>
    );
  }
}

export default withApi(ExternalIssueList);
