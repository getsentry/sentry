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
import Feature from 'app/components/feature';
import IntegrationItem from 'app/views/organizationIntegrations/integrationItem';
import Link from 'app/components/link';
import Switch from 'app/components/switch';
import Tooltip from 'app/components/tooltip';

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
            <Feature access={['project:integrations']}>
              {({hasAccess}) => (
                <React.Fragment>
                  <Box px={2}>
                    <Button
                      size="small"
                      disabled={!enabled || !hasAccess}
                      to={`/settings/${orgId}/${projectId}/integrations/${integration
                        .provider.key}/${integration.id}/`}
                    >
                      {t('Configure')}
                    </Button>
                  </Box>
                  <Tooltip
                    title="You don't have permission to enable or disable project integrations"
                    tooltipOptions={{placement: 'left'}}
                    disabled={hasAccess}
                  >
                    <span>
                      <Switch
                        size="lg"
                        isActive={enabled}
                        isDisabled={!hasAccess}
                        toggle={() => this.onToggleEnabled(!enabled, integration)}
                      />
                    </span>
                  </Tooltip>
                </React.Fragment>
              )}
            </Feature>
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
            <Feature access={['org:integrations']}>
              {({hasAccess}) => (
                <Tooltip
                  title="You don't have permission to manage organization integrations"
                  disabled={hasAccess}
                >
                  <span>
                    <Button
                      size="xsmall"
                      disabled={!hasAccess}
                      to={`/settings/${orgId}/integrations/`}
                    >
                      {t('Manage Integrations')}
                    </Button>
                  </span>
                </Tooltip>
              )}
            </Feature>
          </Box>
        </PanelHeader>
        <PanelBody>
          {integrations.length === 0 && (
            <EmptyMessage
              size="large"
              title={t('No Integrations Enabled')}
              description={
                <Feature access={['org:integrations']}>
                  {({hasAccess}) => {
                    const description = t(
                      'Project Integrations can be enabled here for this project. Currently no organization integrations are enabled with project-specific integration capabilities.'
                    );

                    return hasAccess
                      ? tct('[description] Visit the [link] to configure integrations.', {
                          description,
                          link: (
                            <Link to={`/settings/${orgId}/integrations`}>
                              {t('Organization Integration Settings')}
                            </Link>
                          ),
                        })
                      : description;
                  }}
                </Feature>
              }
            />
          )}
          {integrations}
        </PanelBody>
      </Panel>
    );
  }
}
