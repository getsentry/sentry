import {Component, Fragment} from 'react';
import styled from '@emotion/styled';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import type {Client} from 'sentry/api';
import Access from 'sentry/components/acl/access';
import {Button, LinkButton} from 'sentry/components/button';
import Confirm from 'sentry/components/confirm';
import {Alert} from 'sentry/components/core/alert';
import {Switch} from 'sentry/components/core/switch';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import {IconDelete, IconSettings} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {PluginNoProject, PluginProjectItem} from 'sentry/types/integrations';
import type {Organization} from 'sentry/types/organization';
import type {AvatarProject} from 'sentry/types/project';
import type {IntegrationAnalyticsKey} from 'sentry/utils/analytics/integrations';
import withApi from 'sentry/utils/withApi';

type Props = {
  api: Client;
  onPluginEnableStatusChange: (projectId: string, status: boolean) => void;
  onResetConfiguration: (projectId: string) => void;
  organization: Organization;
  plugin: PluginNoProject;
  projectItem: PluginProjectItem;
  trackIntegrationAnalytics: (eventKey: IntegrationAnalyticsKey) => void; // analytics callback
  className?: string;
};

export class InstalledPlugin extends Component<Props> {
  get projectId() {
    return this.props.projectItem.projectId;
  }
  getConfirmMessage() {
    return (
      <Fragment>
        <Alert.Container>
          <Alert type="error" showIcon>
            {t(
              'Deleting this installation will disable the integration for this project and remove any configurations.'
            )}
          </Alert>
        </Alert.Container>
      </Fragment>
    );
  }

  pluginUpdate = async (
    data: Record<PropertyKey, unknown>,
    method: 'POST' | 'DELETE' = 'POST'
  ) => {
    const {organization, projectItem, plugin} = this.props;
    // no try/catch so the caller will have to have it
    await this.props.api.requestPromise(
      `/projects/${organization.slug}/${projectItem.projectSlug}/plugins/${plugin.id}/`,
      {
        method,
        data,
      }
    );
  };

  updatePluginEnableStatus = async (enabled: boolean) => {
    if (enabled) {
      await this.pluginUpdate({enabled});
    } else {
      await this.pluginUpdate({}, 'DELETE');
    }
  };

  handleReset = async () => {
    try {
      addLoadingMessage(t('Removing...'));
      await this.pluginUpdate({reset: true});
      addSuccessMessage(t('Configuration was removed'));
      this.props.onResetConfiguration(this.projectId);
      this.props.trackIntegrationAnalytics('integrations.uninstall_completed');
    } catch (_err) {
      addErrorMessage(t('Unable to remove configuration'));
    }
  };

  handleUninstallClick = () => {
    this.props.trackIntegrationAnalytics('integrations.uninstall_clicked');
  };

  toggleEnablePlugin = async (projectId: string, status = true) => {
    try {
      addLoadingMessage(t('Enabling...'));
      await this.updatePluginEnableStatus(status);
      addSuccessMessage(
        status ? t('Configuration was enabled.') : t('Configuration was disabled.')
      );
      this.props.onPluginEnableStatusChange(projectId, status);
      this.props.trackIntegrationAnalytics(
        status ? 'integrations.enabled' : 'integrations.disabled'
      );
    } catch (_err) {
      addErrorMessage(
        status
          ? t('Unable to enable configuration.')
          : t('Unable to disable configuration.')
      );
    }
  };

  get projectForBadge(): AvatarProject {
    // this function returns the project as needed for the ProjectBadge component
    const {projectItem} = this.props;
    return {
      slug: projectItem.projectSlug,
      platform: projectItem.projectPlatform ? projectItem.projectPlatform : undefined,
    };
  }

  render() {
    const {className, plugin, organization, projectItem} = this.props;
    return (
      <Container data-test-id="installed-plugin">
        <Access access={['org:integrations']}>
          {({hasAccess}) => (
            <IntegrationFlex className={className}>
              <IntegrationItemBox>
                <ProjectBadge project={this.projectForBadge} />
              </IntegrationItemBox>
              <div>
                <StyledLinkButton
                  borderless
                  icon={<IconSettings />}
                  disabled={!hasAccess}
                  to={`/settings/${organization.slug}/projects/${projectItem.projectSlug}/plugins/${plugin.id}/`}
                  data-test-id="integration-configure-button"
                >
                  {t('Configure')}
                </StyledLinkButton>
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
                    icon={<IconDelete />}
                    data-test-id="integration-remove-button"
                  >
                    {t('Uninstall')}
                  </StyledButton>
                </Confirm>
              </div>
              <Switch
                checked={projectItem.enabled}
                onChange={() =>
                  this.toggleEnablePlugin(projectItem.projectId, !projectItem.enabled)
                }
                disabled={!hasAccess}
              />
            </IntegrationFlex>
          )}
        </Access>
      </Container>
    );
  }
}

export default withApi(InstalledPlugin);

const Container = styled('div')`
  padding: ${space(2)};
  border: 1px solid ${p => p.theme.border};
  border-bottom: none;
  background-color: ${p => p.theme.background};

  &:last-child {
    border-bottom: 1px solid ${p => p.theme.border};
  }
`;

const StyledButton = styled(Button)`
  color: ${p => p.theme.gray300};
`;

const StyledLinkButton = styled(LinkButton)`
  color: ${p => p.theme.gray300};
`;

const IntegrationFlex = styled('div')`
  display: flex;
  align-items: center;
`;

const IntegrationItemBox = styled('div')`
  flex: 1 0 fit-content;
  box-sizing: border-box;
  display: flex;
  flex-direction: row;
  min-width: 0;
`;
