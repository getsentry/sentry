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

    if (!activeIntegrations.length)
      return (
        <AlertLink
          icon="icon-generic-box"
          priority="default"
          size="small"
          to={`/settings/${this.props.orgId}/integrations`}
        >
          {t('Set up Issue Tracking')}
        </AlertLink>
      );

    const externalIssues = activeIntegrations.map(integration => (
      <ExternalIssueActions
        key={integration.id}
        integration={integration}
        group={group}
      />
    ));

    return <Box mb={3}>{externalIssues}</Box>;
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

    return group.pluginActions
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
    return (
      <div>
        <h6>
          <span>Linked Issues</span>
        </h6>
        {this.renderIntegrationIssues(this.state.integrations)}
        {this.renderPluginIssues()}
        {this.renderPluginActions()}
      </div>
    );
  }
}

export default ExternalIssueList;
