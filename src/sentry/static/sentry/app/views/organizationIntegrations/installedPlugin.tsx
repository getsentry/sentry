import React from 'react';
import styled from '@emotion/styled';

import {t} from 'app/locale';
import space from 'app/styles/space';
import Access from 'app/components/acl/access';
import Button from 'app/components/button';
import Confirm from 'app/components/confirm';
import Alert from 'app/components/alert';
import PluginIcon from 'app/plugins/components/pluginIcon';
import withApi from 'app/utils/withApi';
import {Client} from 'app/api';
import {enablePlugin} from 'app/actionCreators/plugins';
import {PluginNoProject, PluginProjectItem, Organization} from 'app/types';

export type Props = {
  api: Client;
  plugin: PluginNoProject;
  projectItem: PluginProjectItem;
  organization: Organization;
  onResetConfiguration: (projectId: string) => void;
  onEnablePlugin: (projectId: string) => void;
  onRemove?: () => void;
  onDisable?: () => void;
  className?: string;
};

export class InstalledPlugin extends React.Component<Props> {
  removeConfirmProps() {
    // const {plugin} = this.props;

    const message = (
      <React.Fragment>
        <Alert type="error" icon="icon-circle-exclamation">
          {t(
            'Deleting this installation will disable the integration for this project and remove any configurations.'
          )}
        </Alert>
      </React.Fragment>
    );
    return {
      message,
      confirmText: 'Delete Installation',
      onConfirm: () => this.handleReset(),
    };
  }

  handleReset = async () => {
    //TODO(steve): add loading
    const {organization, projectItem, plugin} = this.props;
    try {
      await this.props.api.requestPromise(
        `/projects/${organization.slug}/${projectItem.projectSlug}/plugins/${plugin.id}/`,
        {
          method: 'POST',
          data: {reset: true},
        }
      );
      this.props.onResetConfiguration(this.props.projectItem.projectId);
    } catch (_err) {
      console.error(_err);
    }
  };

  handleUninstallClick = () => {
    //TODO: Analytics
  };
  hasConfiguration() {
    return this.props.projectItem.configured;
  }

  enablePlugin = async () => {
    const {organization, projectItem, plugin} = this.props;
    const params = {
      orgId: organization.slug,
      projectId: projectItem.projectSlug,
      pluginId: plugin.id,
    };
    //XXX(Steve): messaging says plugin, might want to do something different
    //action handles messaging errors so we don't have to here
    await enablePlugin(params);
    this.props.onEnablePlugin(projectItem.projectId);
  };

  render() {
    const {className, plugin, organization, projectItem} = this.props;

    return (
      <Container>
        <Access access={['org:integrations']}>
          {({hasAccess}) => (
            <IntegrationFlex className={className}>
              <IntegrationItemBox>
                <PluginIcon pluginId={plugin.id} size={22} />
                <IntegrationName>{projectItem.projectName}</IntegrationName>
              </IntegrationItemBox>
              <div>
                {!projectItem.enabled && this.hasConfiguration() && (
                  <Button size="small" priority="primary" onClick={this.enablePlugin}>
                    {t('Enable')}
                  </Button>
                )}
                {projectItem.enabled && this.hasConfiguration() && (
                  <StyledButton
                    borderless
                    icon="icon-settings"
                    disabled={!this.hasConfiguration() || !hasAccess}
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
                  {...this.removeConfirmProps()}
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

// const IntegrationItemBox = styled('div')`
//   flex: 1;
// `;

const IntegrationName = styled('div')`
  font-size: 1.6rem;
  padding-left: ${space(1)};
  display: flex;
`;

const IntegrationItemBox = styled('div')`
  flex: 1;
  box-sizing: border-box;
  display: flex;
  flex-direction: row;
  min-width: 0;
`;
