import React from 'react';
import styled from '@emotion/styled';

import {PluginWithProjectList, PluginProjectItem} from 'app/types';
import space from 'app/styles/space';
import withOrganization from 'app/utils/withOrganization';
import Button from 'app/components/button';
import InstalledPlugin from 'app/views/organizationIntegrations/installedPlugin';
import * as modal from 'app/actionCreators/modal';
import ContextPickerModal from 'app/components/contextPickerModal';
import {t} from 'app/locale';
import AbstractIntegrationDetailedView from './abstractIntegrationDetailedView';
import {legacyIds} from './constants';

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
    const isLegacy = legacyIds.includes(this.plugin.id);
    const displayName = `${this.plugin.name} ${isLegacy ? '(Legacy)' : ''}`;
    return displayName;
  }

  get featureData() {
    return this.plugin.featureDescriptions;
  }

  handleResetConfiguration = (projectId: string) => {
    //make a copy of our project list
    const projectList = this.plugin.projectList.slice();
    //find the index of the project
    const index = projectList.findIndex(item => item.projectId === projectId);
    //should match but quit if it doesn't
    if (index < 0) {
      return;
    }
    //remove from array
    projectList.splice(index, 1);
    //update state
    this.setState({
      plugins: [{...this.state.plugins[0], projectList}],
    });
  };

  handleEnablePlugin = (projectId: string) => {
    //make a copy of our project list
    const projectList = this.plugin.projectList.slice();
    //find the index of the project
    const index = projectList.findIndex(item => item.projectId === projectId);
    //should match but quit if it doesn't
    if (index < 0) {
      return;
    }

    //update item in array
    projectList[index] = {
      ...projectList[index],
      enabled: true,
    };

    //update state
    this.setState({
      plugins: [{...this.state.plugins[0], projectList}],
    });
  };

  handleAddToProject = () => {
    const plugin = this.plugin;
    const {organization, router} = this.props;
    modal.openModal(
      ({closeModal, Header, Body}) => (
        <ContextPickerModal
          Header={Header}
          Body={Body}
          nextPath={`/settings/${organization.slug}/projects/:projectId/plugins/${plugin.id}/`}
          needProject
          needOrg={false}
          onFinish={path => {
            closeModal();
            router.push(path);
          }}
        />
      ),
      {}
    );
  };

  getTabDiplay(tab: Tab) {
    //we want to show project configurations to make it more clear
    if (tab === 'configurations') {
      return 'project configurations';
    }
    return tab;
  }

  renderTopButton(disabledFromFeatures: boolean, userHasAccess: boolean) {
    return (
      <AddButton
        data-test-id="add-button"
        disabled={disabledFromFeatures || !userHasAccess}
        onClick={this.handleAddToProject}
        size="small"
        priority="primary"
      >
        {t('Add to Project')}
      </AddButton>
    );
  }

  renderConfigurations() {
    const plugin = this.plugin;
    const {organization} = this.props;
    return (
      <div>
        {plugin.projectList.map((projectItem: PluginProjectItem) => (
          <InstalledPlugin
            key={projectItem.projectId}
            organization={organization}
            plugin={plugin}
            projectItem={projectItem}
            onResetConfiguration={this.handleResetConfiguration}
            onEnablePlugin={this.handleEnablePlugin}
          />
        ))}
      </div>
    );
  }
}

const AddButton = styled(Button)`
  margin-left: ${space(1)};
`;

export default withOrganization(PluginDetailedView);
