import {Fragment} from 'react';
import styled from '@emotion/styled';

import * as modal from 'sentry/actionCreators/modal';
import AsyncComponent from 'sentry/components/asyncComponent';
import Button from 'sentry/components/button';
import ContextPickerModal from 'sentry/components/contextPickerModal';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {PluginProjectItem, PluginWithProjectList} from 'sentry/types';
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
  getEndpoints(): ReturnType<AsyncComponent['getEndpoints']> {
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
    // @ts-expect-error TS(2532) FIXME: Object is possibly 'undefined'.
    return this.plugin.description || '';
  }

  get author() {
    // @ts-expect-error TS(2532) FIXME: Object is possibly 'undefined'.
    return this.plugin.author?.name;
  }

  get resourceLinks() {
    // @ts-expect-error TS(2532) FIXME: Object is possibly 'undefined'.
    return this.plugin.resourceLinks || [];
  }

  get installationStatus() {
    // @ts-expect-error TS(2532) FIXME: Object is possibly 'undefined'.
    return this.plugin.projectList.length > 0 ? 'Installed' : 'Not Installed';
  }

  get integrationName() {
    // @ts-expect-error TS(2532) FIXME: Object is possibly 'undefined'.
    return `${this.plugin.name}${this.plugin.isHidden ? ' (Legacy)' : ''}`;
  }

  get featureData() {
    // @ts-expect-error TS(2532) FIXME: Object is possibly 'undefined'.
    return this.plugin.featureDescriptions;
  }

  handleResetConfiguration = (projectId: string) => {
    // make a copy of our project list
    // @ts-expect-error TS(2532) FIXME: Object is possibly 'undefined'.
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
      // @ts-expect-error TS(2322) FIXME: Type '{ projectList: PluginProjectItem[]; assets?:... Remove this comment to see the full error message
      plugins: [{...this.state.plugins[0], projectList}],
    });
  };

  handlePluginEnableStatus = (projectId: string, enable: boolean = true) => {
    // make a copy of our project list
    // @ts-expect-error TS(2532) FIXME: Object is possibly 'undefined'.
    const projectList = this.plugin.projectList.slice();
    // find the index of the project
    const index = projectList.findIndex(item => item.projectId === projectId);
    // should match but quit if it doesn't
    if (index < 0) {
      return;
    }

    // update item in array
    // @ts-expect-error TS(2322) FIXME: Type '{ enabled: boolean; configured?: boolean | u... Remove this comment to see the full error message
    projectList[index] = {
      ...projectList[index],
      enabled: enable,
    };

    // update state
    this.setState({
      // @ts-expect-error TS(2322) FIXME: Type '{ projectList: PluginProjectItem[]; assets?:... Remove this comment to see the full error message
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
          // @ts-expect-error TS(2532) FIXME: Object is possibly 'undefined'.
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

    // @ts-expect-error TS(2532) FIXME: Object is possibly 'undefined'.
    if (plugin.projectList.length) {
      return (
        <Fragment>
          {/* @ts-expect-error TS(2769) FIXME: No overload matches this call. */}
          <PluginDeprecationAlert organization={organization} plugin={plugin} />
          <div>
            {/* @ts-expect-error TS(2532) FIXME: Object is possibly 'undefined'. */}
            {plugin.projectList.map((projectItem: PluginProjectItem) => (
              <InstalledPlugin
                key={projectItem.projectId}
                organization={organization}
                // @ts-expect-error TS(2322) FIXME: Type 'PluginWithProjectList | undefined' is not as... Remove this comment to see the full error message
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
