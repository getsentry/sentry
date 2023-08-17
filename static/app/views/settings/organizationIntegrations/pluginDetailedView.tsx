import {Fragment} from 'react';
import styled from '@emotion/styled';

import * as modal from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/button';
import ContextPickerModal from 'sentry/components/contextPickerModal';
import DeprecatedAsyncComponent from 'sentry/components/deprecatedAsyncComponent';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {PluginProjectItem, PluginWithProjectList} from 'sentry/types';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import withOrganization from 'sentry/utils/withOrganization';

import AbstractIntegrationDetailedView from './abstractIntegrationDetailedView';
import InstalledPlugin from './installedPlugin';
import PluginDeprecationAlert from './pluginDeprecationAlert';

type State = {
  plugins: PluginWithProjectList[];
};

type Tab = AbstractIntegrationDetailedView['state']['tab'];

class PluginDetailedView extends AbstractIntegrationDetailedView<
  AbstractIntegrationDetailedView['props'],
  State & AbstractIntegrationDetailedView['state']
> {
  getEndpoints(): ReturnType<DeprecatedAsyncComponent['getEndpoints']> {
    const {organization} = this.props;
    const {integrationSlug} = this.props.params;
    return [
      [
        'plugins',
        `/organizations/${organization.slug}/plugins/configs/?plugins=${integrationSlug}`,
      ],
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
            router.push(normalizeUrl(path));
          }}
        />
      ),
      {closeEvents: 'escape-key'}
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
          size="sm"
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

    if (plugin.projectList.length) {
      return (
        <Fragment>
          <PluginDeprecationAlert organization={organization} plugin={plugin} />
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

export default withOrganization(PluginDetailedView);
