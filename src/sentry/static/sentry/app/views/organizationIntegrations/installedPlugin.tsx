import React from 'react';
import styled from '@emotion/styled';

import {t} from 'app/locale';
import Access from 'app/components/acl/access';
import Button from 'app/components/button';
import Confirm from 'app/components/confirm';
import Alert from 'app/components/alert';
import ProjectBadge from 'app/components/idBadge/projectBadge';
import withApi from 'app/utils/withApi';
import {Client} from 'app/api';
import {
  addErrorMessage,
  addSuccessMessage,
  addLoadingMessage,
} from 'app/actionCreators/indicator';
import {PluginNoProject, PluginProjectItem, Organization, AvatarProject} from 'app/types';
import {SingleIntegrationEvent} from 'app/utils/integrationUtil';

export type Props = {
  api: Client;
  plugin: PluginNoProject;
  projectItem: PluginProjectItem;
  organization: Organization;
  onResetConfiguration: (projectId: string) => void;
  onEnablePlugin: (projectId: string) => void;
  trackIntegrationEvent: (
    options: Pick<SingleIntegrationEvent, 'eventKey' | 'eventName'> & {project_id: string}
  ) => void; //analytics callback
  className?: string;
};

export class InstalledPlugin extends React.Component<Props> {
  get projectId() {
    return this.props.projectItem.projectId;
  }
  getConfirmMessage() {
    return (
      <React.Fragment>
        <Alert type="error" icon="icon-circle-exclamation">
          {t(
            'Deleting this installation will disable the integration for this project and remove any configurations.'
          )}
        </Alert>
      </React.Fragment>
    );
  }

  pluginUpdate = async (data: object) => {
    const {organization, projectItem, plugin} = this.props;
    // no try/catch so the caller will have to have it
    await this.props.api.requestPromise(
      `/projects/${organization.slug}/${projectItem.projectSlug}/plugins/${plugin.id}/`,
      {
        method: 'POST',
        data,
      }
    );
  };

  handleReset = async () => {
    try {
      addLoadingMessage(t('Removing...'));
      await this.pluginUpdate({reset: true});
      addSuccessMessage(t('Configuration was removed'));
      this.props.onResetConfiguration(this.projectId);
      this.props.trackIntegrationEvent({
        eventKey: 'integrations.uninstall_completed',
        eventName: 'Integrations: Uninstall Completed',
        project_id: this.projectId,
      });
    } catch (_err) {
      addErrorMessage(t('Unable to remove configuration'));
    }
  };

  handleUninstallClick = () => {
    this.props.trackIntegrationEvent({
      eventKey: 'integrations.uninstall_clicked',
      eventName: 'Integrations: Uninstall Clicked',
      project_id: this.projectId,
    });
  };

  enablePlugin = async () => {
    try {
      addLoadingMessage(t('Enabling...'));
      await this.pluginUpdate({enabled: true});
      addSuccessMessage(t('Configuration was enabled'));
      this.props.onEnablePlugin(this.projectId);
      this.props.trackIntegrationEvent({
        eventKey: 'integrations.enabled',
        eventName: 'Integrations: Enabled',
        project_id: this.projectId,
      });
    } catch (_err) {
      addErrorMessage(t('Unable to enable configuration'));
    }
  };

  get projectForBadge(): AvatarProject {
    //this function returns the project as needed for the ProjectBadge component
    const {projectItem} = this.props;
    return {
      slug: projectItem.projectSlug,
      platform: projectItem.projectPlatform ? projectItem.projectPlatform : undefined,
    };
  }

  render() {
    const {className, plugin, organization, projectItem} = this.props;

    return (
      <Container>
        <Access access={['org:integrations']}>
          {({hasAccess}) => (
            <IntegrationFlex className={className}>
              <IntegrationItemBox>
                <ProjectBadge project={this.projectForBadge} />
              </IntegrationItemBox>
              <div>
                {!projectItem.enabled ? (
                  <Button size="small" priority="primary" onClick={this.enablePlugin}>
                    {t('Enable')}
                  </Button>
                ) : (
                  <StyledButton
                    borderless
                    icon="icon-settings"
                    disabled={!hasAccess}
                    to={`/settings/${organization.slug}/projects/${projectItem.projectSlug}/plugins/${plugin.id}/`}
                    data-test-id="integration-configure-button"
                  >
                    {t('Configure')}
                  </StyledButton>
                )}
              </div>
              <div>
                <Confirm
                  priority="danger"
                  onConfirming={this.handleUninstallClick}
                  disabled={!hasAccess}
                  confirmText="Delete Installation"
                  onConfirm={() => this.handleReset()}
                  message={this.getConfirmMessage()}
                >
                  <StyledButton
                    disabled={!hasAccess}
                    borderless
                    icon="icon-trash"
                    data-test-id="integration-remove-button"
                  >
                    {t('Uninstall')}
                  </StyledButton>
                </Confirm>
              </div>
            </IntegrationFlex>
          )}
        </Access>
      </Container>
    );
  }
}

export default withApi(InstalledPlugin);

const Container = styled('div')`
  margin: 10px;
`;

const StyledButton = styled(Button)`
  color: ${p => p.theme.gray2};
`;

const IntegrationFlex = styled('div')`
  display: flex;
  align-items: center;
`;

const IntegrationItemBox = styled('div')`
  flex: 1;
  box-sizing: border-box;
  display: flex;
  flex-direction: row;
  min-width: 0;
`;
