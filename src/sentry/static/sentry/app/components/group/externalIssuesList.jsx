import React from 'react';
import PropTypes from 'prop-types';

import AsyncComponent from 'app/components/asyncComponent';
import ExternalIssueActions from 'app/components/group/externalIssueActions';
import IssueSyncListElement from 'app/components/issueSyncListElement';
import AlertLink from 'app/components/alertLink';
import SentryTypes from 'app/sentryTypes';
import PluginActions from 'app/components/group/pluginActions';
import {Box} from 'grid-emotion';
import {t} from 'app/locale';

class ExternalIssueList extends AsyncComponent {
  static propTypes = {
    group: SentryTypes.Group.isRequired,
    orgId: PropTypes.string,
  };

  getEndpoints() {
    let {group} = this.props;
    return [['integrations', `/groups/${group.id}/integrations/`]];
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

  renderPluginIssues() {
    const {group} = this.props;

    return group.pluginIssues && group.pluginIssues.length
      ? group.pluginIssues.map((plugin, i) => {
          return <PluginActions group={group} plugin={plugin} key={i} />;
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
    const integrationIssues = this.renderIntegrationIssues(this.state.integrations);
    const pluginIssues = this.renderPluginIssues();
    const pluginActions = this.renderPluginActions();

    if (!integrationIssues && !pluginIssues && !pluginActions)
      return (
        <React.Fragment>
          <h6>
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

    return (
      <React.Fragment>
        <h6>
          <span>Linked Issues</span>
        </h6>
        {integrationIssues && <Box mb={2}>{integrationIssues}</Box>}
        {pluginIssues && <Box mb={2}>{pluginIssues}</Box>}
        {pluginActions && <Box mb={2}>{pluginActions}</Box>}
      </React.Fragment>
    );
  }
}

export default ExternalIssueList;
