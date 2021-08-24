import {Fragment} from 'react';
import styled from '@emotion/styled';

import * as modal from 'app/actionCreators/modal';
import Alert from 'app/components/alert';
import Button from 'app/components/button';
import ContextPickerModal from 'app/components/contextPickerModal';
import {IconWarning} from 'app/icons';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {PluginProjectItem, PluginWithProjectList} from 'app/types';
import {trackIntegrationEvent} from 'app/utils/integrationUtil';
import withOrganization from 'app/utils/withOrganization';

import AbstractIntegrationDetailedView from './abstractIntegrationDetailedView';
import InstalledPlugin from './installedPlugin';

type State = {
  plugins: PluginWithProjectList[];
};

type Tab = AbstractIntegrationDetailedView['state']['tab'];

class PluginDetailedView extends AbstractIntegrationDetailedView<
  AbstractIntegrationDetailedView['props'],
  State & AbstractIntegrationDetailedView['state']
> {
  getEndpoints(): ([string, string, any] | [string, string])[] {
    const {orgId, integrationSlug} = this.props.params;
    return [
      ['plugins', `/organizations/${orgId}/plugins/configs/?plugins=${integrationSlug}`],
    ];
  }

  get integrationType() {
    return 'plugin' as const;
  }

  get plugin() {
    return this.state.plugins[0];
  }

  get description() {
    return this.plugin.description || '';
  }

  get author() {
    return this.plugin.author?.name;
  }

  get resourceLinks() {
    return this.plugin.resourceLinks || [];
  }

  get installationStatus() {
    return this.plugin.projectList.length > 0 ? 'Installed' : 'Not Installed';
  }

  get integrationName() {
    return `${this.plugin.name}${this.plugin.isHidden ? ' (Legacy)' : ''}`;
  }

  get featureData() {
    return this.plugin.featureDescriptions;
  }

  handleResetConfiguration = (projectId: string) => {
    // make a copy of our project list
    const projectList = this.plugin.projectList.slice();
    // find the index of the project
    const index = projectList.findIndex(item => item.projectId === projectId);
    // should match but quit if it doesn't
    if (index < 0) {
      return;
    }
    // remove from array
    projectList.splice(index, 1);
    // update state
    this.setState({
      plugins: [{...this.state.plugins[0], projectList}],
    });
  };

  handlePluginEnableStatus = (projectId: string, enable: boolean = true) => {
    // make a copy of our project list
    const projectList = this.plugin.projectList.slice();
    // find the index of the project
    const index = projectList.findIndex(item => item.projectId === projectId);
    // should match but quit if it doesn't
    if (index < 0) {
      return;
    }

    // update item in array
    projectList[index] = {
      ...projectList[index],
      enabled: enable,
    };

    // update state
    this.setState({
      plugins: [{...this.state.plugins[0], projectList}],
    });
  };

  handleAddToProject = () => {
    const plugin = this.plugin;
    const {organization, router} = this.props;
    this.trackIntegrationAnalytics('integrations.plugin_add_to_project_clicked');
    modal.openModal(
      modalProps => (
        <ContextPickerModal
          {...modalProps}
          nextPath={`/settings/${organization.slug}/projects/:projectId/plugins/${plugin.id}/`}
          needProject
          needOrg={false}
          onFinish={path => {
            modalProps.closeModal();
            router.push(path);
          }}
        />
      ),
      {allowClickClose: false}
    );
  };

  getTabDisplay(tab: Tab) {
    // we want to show project configurations to make it more clear
    if (tab === 'configurations') {
      return 'project configurations';
    }
    return 'overview';
  }

  renderTopButton(disabledFromFeatures: boolean, userHasAccess: boolean) {
    if (userHasAccess) {
      return (
        <AddButton
          data-test-id="install-button"
          disabled={disabledFromFeatures}
          onClick={this.handleAddToProject}
          size="small"
          priority="primary"
        >
          {t('Add to Project')}
        </AddButton>
      );
    }

    return this.renderRequestIntegrationButton();
  }

  renderConfigurations() {
    const plugin = this.plugin;
    const {organization} = this.props;

    let upgradeUrl = '';
    let deprecationText = '';
    if (plugin.deprecationDate !== null) {
      deprecationText = `This integration is being deprecated on ${plugin.deprecationDate}. Please upgrade to avoid any disruption.`;
    }
    if (plugin.firstPartyAlternative !== null) {
      upgradeUrl =
        plugin.altIsSentryApp === false
          ? `/settings/${organization.slug}/integrations/${plugin.firstPartyAlternative}/`
          : `/settings/${organization.slug}/sentry-apps/${plugin.firstPartyAlternative}/`;
    }

    if (plugin.projectList.length && plugin.deprecationText !== '') {
      return (
        <Fragment>
          {plugin.deprecationDate && (
            <AlertContainer>
              <Alert type="warning" icon={<IconWarning size="sm" />}>
                <span>{deprecationText}</span>
                <ResolveNowButton
                  href={`${upgradeUrl}?tab=configurations&referrer=directory_upgrade_now`}
                  size="xsmall"
                  onClick={() =>
                    trackIntegrationEvent('integrations.resolve_now_clicked', {
                      integration_type: 'plugin',
                      integration: plugin.slug,
                      organization,
                    })
                  }
                >
                  {t('Upgrade Now')}
                </ResolveNowButton>
              </Alert>
            </AlertContainer>
          )}
          <div>
            {plugin.projectList.map((projectItem: PluginProjectItem) => (
              <InstalledPlugin
                key={projectItem.projectId}
                organization={organization}
                plugin={plugin}
                projectItem={projectItem}
                onResetConfiguration={this.handleResetConfiguration}
                onPluginEnableStatusChange={this.handlePluginEnableStatus}
                trackIntegrationAnalytics={this.trackIntegrationAnalytics}
              />
            ))}
          </div>
        </Fragment>
      );
    }
    return this.renderEmptyConfigurations();
  }
}

const AddButton = styled(Button)`
  margin-bottom: ${space(1)};
`;

const ResolveNowButton = styled(Button)`
  color: ${p => p.theme.subText};
  float: right;
`;

const AlertContainer = styled('div')`
  padding: 0px ${space(3)} 0px 68px;
`;

export default withOrganization(PluginDetailedView);
