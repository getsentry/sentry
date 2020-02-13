import React from 'react';
import styled from '@emotion/styled';

import {PluginWithProjectList, PluginNoProject, PluginProjectItem} from 'app/types';
import space from 'app/styles/space';
import withOrganization from 'app/utils/withOrganization';
import Button from 'app/components/button';
import ExternalLink from 'app/components/links/externalLink';
import InstalledPlugin from 'app/views/organizationIntegrations/installedPlugin';
import {openModal} from 'app/actionCreators/modal';
import ContextPickerModal from 'app/components/contextPickerModal';
import {getIntegrationFeatureGate} from 'app/utils/integrationUtil';
import {t} from 'app/locale';
import AbstractIntegrationDetailedView from './abstractIntegrationDetailedView';

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

  get installationStatus() {
    return this.plugin.projectList.length > 0 ? 'Installed' : 'Not Installed';
  }

  get integrationName() {
    return this.plugin.name;
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
    openModal(
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

  mapPluginToProvider() {
    const plugin = this.plugin;
    return {
      key: plugin.slug,
    };
  }

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

  renderInformationCard() {
    const plugin = this.plugin;
    const {organization} = this.props;

    // Prepare the features list
    const features = plugin.featureDescriptions.map(f => ({
      featureGate: f.featureGate,
      description: <FeatureListItem>{f.description}</FeatureListItem>,
    }));

    const {FeatureList} = getIntegrationFeatureGate();
    const featureProps = {organization, features};
    return (
      <InformationCard plugin={plugin}>
        <FeatureList {...featureProps} provider={this.mapPluginToProvider()} />
      </InformationCard>
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

const Flex = styled('div')`
  display: flex;
`;

const Description = styled('div')`
  font-size: 1.5rem;
  line-height: 2.1rem;
  margin-bottom: ${space(2)};

  li {
    margin-bottom: 6px;
  }
`;

const Metadata = styled(Flex)`
  font-size: 0.9em;
  margin-bottom: ${space(2)};

  a {
    margin-left: ${space(1)};
  }
`;

const AuthorName = styled('div')`
  color: ${p => p.theme.gray2};
  flex: 1;
`;

const FeatureListItem = styled('span')`
  line-height: 24px;
`;

const AddButton = styled(Button)`
  margin-left: ${space(1)};
`;

type InformationCardProps = {
  children: React.ReactNode;
  plugin: PluginNoProject;
};

const InformationCard = ({children, plugin}: InformationCardProps) => {
  return (
    <React.Fragment>
      <Description>{plugin.description}</Description>
      {children}
      <Metadata>
        {plugin.author && <AuthorName>{t('By %s', plugin.author.name)}</AuthorName>}
        <div>
          {/** TODO: May want to make resource links have same title as global integrations */}
          {plugin.resourceLinks &&
            plugin.resourceLinks.map(({title, url}) => (
              <ExternalLink key={url} href={url}>
                {title}
              </ExternalLink>
            ))}
        </div>
      </Metadata>
    </React.Fragment>
  );
};

export default withOrganization(PluginDetailedView);
