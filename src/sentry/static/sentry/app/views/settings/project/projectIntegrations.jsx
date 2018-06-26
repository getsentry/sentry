import {Box} from 'grid-emotion';
import React from 'react';

import {Panel, PanelBody, PanelHeader, PanelItem} from 'app/components/panels';
import {
  addIntegrationToProject,
  removeIntegrationFromProject,
} from 'app/actionCreators/integrations';
import {t, tct} from 'app/locale';
import AsyncComponent from 'app/components/asyncComponent';
import Button from 'app/components/buttons/button';
import EmptyMessage from 'app/views/settings/components/emptyMessage';
import IntegrationItem from 'app/views/organizationIntegrations/integrationItem';
import Link from 'app/components/link';
import Switch from 'app/components/switch';
import TextBlock from 'app/views/settings/components/text/textBlock';
import space from 'app/styles/space';

export default class ProjectIntegrations extends AsyncComponent {
  getEndpoints() {
    let {orgId} = this.props.params;
    return [['integrations', `/organizations/${orgId}/integrations/`]];
  }

  onToggleEnabled(enabled, integration) {
    const {orgId, projectId} = this.props.params;

    const promise = enabled
      ? addIntegrationToProject(orgId, projectId, integration)
      : removeIntegrationFromProject(orgId, projectId, integration);

    promise.then(() => {
      const integrations = [...this.state.integrations];
      const integRef = integrations.find(i => i.id === integration.id);

      if (enabled) {
        integRef.projects.push(projectId);
      } else {
        integRef.projects = integRef.projects.filter(p => p !== projectId);
      }

      this.setState({integrations});
    });
  }

  renderBody() {
    const {orgId, projectId} = this.props.params;

    const integrations = this.state.integrations
      .filter(integration => integration.provider.canAddProject)
      .map(integration => {
        const enabled = integration.projects.includes(projectId);

        return (
          <PanelItem key={integration.id} align="center">
            <Box flex={1}>
              <IntegrationItem integration={integration} />
            </Box>
            <Box px={2}>
              <Button
                size="small"
                disabled={!enabled}
                to={`/settings/${orgId}/${projectId}/integrations/${integration.provider
                  .key}/${integration.id}/`}
              >
                {t('Configure')}
              </Button>
            </Box>
            <Switch
              size="lg"
              isActive={enabled}
              toggle={() => this.onToggleEnabled(!enabled, integration)}
            />
          </PanelItem>
        );
      });

    return (
      <Panel>
        <PanelHeader disablePadding hasButtons>
          <Box px={2} flex="1">
            {t('Project Integrations')}
          </Box>
          <Box pr={1}>
            <Button size="xsmall" to={`/settings/${orgId}/integrations/`}>
              {t('Manage Integrations')}
            </Button>
          </Box>
        </PanelHeader>
        <PanelBody>
          {integrations.length === 0 && (
            <EmptyMessage
              size="large"
              title={t('No Integrations Enabled')}
              description={tct(
                'Project Integrations can be enabled here for this project. Currently no organization integrations are enabled with project-specific integration capabilities. Visit the [link] to configure integrations.',
                {
                  link: (
                    <Link to={`/settings/${orgId}/integrations`}>
                      Organization Integration Settings
                    </Link>
                  ),
                }
              )}
            />
          )}
          {integrations}
        </PanelBody>
      </Panel>
    );
  }
}
