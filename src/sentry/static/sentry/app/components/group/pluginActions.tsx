import React from 'react';
import PropTypes from 'prop-types';

import {addErrorMessage, addSuccessMessage} from 'app/actionCreators/indicator';
import {ModalRenderProps, openModal} from 'app/actionCreators/modal';
import {Client} from 'app/api';
import IssueSyncListElement from 'app/components/issueSyncListElement';
import NavTabs from 'app/components/navTabs';
import {t, tct} from 'app/locale';
import plugins from 'app/plugins';
import SentryTypes from 'app/sentryTypes';
import {Group, Organization, Plugin, Project} from 'app/types';
import withApi from 'app/utils/withApi';
import withOrganization from 'app/utils/withOrganization';

type PluginIssue = {
  issue_id: string;
  url: string;
  label: string;
};

type TitledPlugin = Plugin & {
  // issue serializer adds more fields
  // TODO: should be able to use name instead of title
  title: string;
};

type Props = {
  api: Client;
  group: Group;
  organization: Organization;
  project: Project;
  plugin: TitledPlugin;
};

type State = {
  issue: PluginIssue | null;
  pluginLoading: boolean;
};

class PluginActions extends React.Component<Props, State> {
  static propTypes: any = {
    api: PropTypes.object,
    group: SentryTypes.Group.isRequired,
    organization: SentryTypes.Organization.isRequired,
    project: SentryTypes.Project.isRequired,
    plugin: PropTypes.object.isRequired,
  };

  state: State = {
    issue: null,
    pluginLoading: false,
  };

  componentDidMount() {
    this.loadPlugin(this.props.plugin);
  }

  UNSAFE_componentWillReceiveProps(nextProps: Props) {
    if (this.props.plugin.id !== nextProps.plugin.id) {
      this.loadPlugin(nextProps.plugin);
    }
  }

  deleteIssue = () => {
    const plugin = {
      ...this.props.plugin,
      issue: null,
    };
    // override plugin.issue so that 'create/link' Modal
    // doesn't think the plugin still has an issue linked
    const endpoint = `/issues/${this.props.group.id}/plugins/${plugin.slug}/unlink/`;
    this.props.api.request(endpoint, {
      success: () => {
        this.loadPlugin(plugin);
        addSuccessMessage(t('Successfully unlinked issue.'));
      },
      error: () => {
        addErrorMessage(t('Unable to unlink issue'));
      },
    });
  };

  loadPlugin = (data: any) => {
    this.setState(
      {
        pluginLoading: true,
      },
      () => {
        plugins.load(data, () => {
          const issue = data.issue || null;
          this.setState({pluginLoading: false, issue});
        });
      }
    );
  };

  handleModalClose = (data?: any) =>
    this.setState({
      issue:
        data?.id && data?.link
          ? {issue_id: data.id, url: data.link, label: data.label}
          : null,
    });

  openModal = () => {
    const {issue} = this.state;
    const {project, group, organization} = this.props;
    const plugin = {...this.props.plugin, issue};

    openModal(
      deps => (
        <PluginActionsModal
          {...deps}
          project={project}
          group={group}
          organization={organization}
          plugin={plugin}
          onSuccess={this.handleModalClose}
        />
      ),
      {onClose: this.handleModalClose}
    );
  };

  render() {
    const {issue} = this.state;
    const plugin = {...this.props.plugin, issue};

    return (
      <IssueSyncListElement
        onOpen={this.openModal}
        externalIssueDisplayName={issue ? issue.label : null}
        externalIssueId={issue ? issue.issue_id : null}
        externalIssueLink={issue ? issue.url : null}
        onClose={this.deleteIssue}
        integrationType={plugin.id}
      />
    );
  }
}

type ModalProps = ModalRenderProps & {
  group: Group;
  project: Project;
  organization: Organization;
  plugin: TitledPlugin & {issue: PluginIssue | null};
  onSuccess: (data: any) => void;
};

type ModalState = {
  actionType: 'create' | 'link' | null;
};

class PluginActionsModal extends React.Component<ModalProps, ModalState> {
  state: ModalState = {
    actionType: 'create',
  };

  render() {
    const {Header, Body, group, project, organization, plugin, onSuccess} = this.props;
    const {actionType} = this.state;

    return (
      <React.Fragment>
        <Header closeButton>
          {tct('[name] Issue', {name: plugin.name || plugin.title})}
        </Header>
        <NavTabs underlined>
          <li className={actionType === 'create' ? 'active' : ''}>
            <a onClick={() => this.setState({actionType: 'create'})}>{t('Create')}</a>
          </li>
          <li className={actionType === 'link' ? 'active' : ''}>
            <a onClick={() => this.setState({actionType: 'link'})}>{t('Link')}</a>
          </li>
        </NavTabs>
        {actionType && (
          // need the key here so React will re-render
          // with new action prop
          <Body key={actionType}>
            {plugins.get(plugin).renderGroupActions({
              plugin,
              group,
              project,
              organization,
              actionType,
              onSuccess,
            })}
          </Body>
        )}
      </React.Fragment>
    );
  }
}

export {PluginActions};

export default withApi(withOrganization(PluginActions));
