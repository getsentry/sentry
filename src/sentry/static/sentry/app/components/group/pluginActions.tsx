import PropTypes from 'prop-types';
import React from 'react';
import Modal from 'react-bootstrap/lib/Modal';

import {Client} from 'app/api';
import withApi from 'app/utils/withApi';
import {addSuccessMessage, addErrorMessage} from 'app/actionCreators/indicator';
import NavTabs from 'app/components/navTabs';
import plugins from 'app/plugins';
import {t} from 'app/locale';
import SentryTypes from 'app/sentryTypes';
import IssueSyncListElement from 'app/components/issueSyncListElement';
import withOrganization from 'app/utils/withOrganization';
import {Organization, Group, Project, Plugin} from 'app/types';

type Props = {
  api: Client;
  group: Group;
  organization: Organization;
  project: Project;
  plugin: Plugin;
};

type State = {
  showModal: boolean;
  actionType: 'create' | 'link' | null;
  issue: {issue_id: string; url: string; label: string} | null;
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
    showModal: false,
    actionType: null,
    issue: null,
    pluginLoading: false,
  };

  componentDidMount() {
    this.loadPlugin(this.props.plugin);
  }

  UNSAFE_componentWillReceiveProps(nextProps) {
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

  loadPlugin = data => {
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

  openModal = () => {
    this.setState({
      showModal: true,
      actionType: 'create',
    });
  };

  closeModal = data => {
    this.setState({
      issue:
        data && data.id && data.link
          ? {issue_id: data.id, url: data.link, label: data.label}
          : null,
      showModal: false,
    });
  };

  handleClick = (actionType: 'create' | 'link') => {
    this.setState({actionType});
  };

  render() {
    const {actionType, issue} = this.state;
    const plugin = {...this.props.plugin, issue};

    return (
      <React.Fragment>
        <IssueSyncListElement
          onOpen={this.openModal}
          externalIssueDisplayName={issue ? issue.label : null}
          externalIssueId={issue ? issue.issue_id : null}
          externalIssueLink={issue ? issue.url : null}
          onClose={this.deleteIssue}
          integrationType={plugin.id}
        />
        <Modal
          show={this.state.showModal}
          onHide={this.closeModal}
          animation={false}
          enforceFocus={false}
        >
          <Modal.Header closeButton>
            <Modal.Title>{`${plugin.name} Issue`}</Modal.Title>
          </Modal.Header>
          <NavTabs underlined>
            <li className={actionType === 'create' ? 'active' : ''}>
              <a onClick={() => this.handleClick('create')}>{t('Create')}</a>
            </li>
            <li className={actionType === 'link' ? 'active' : ''}>
              <a onClick={() => this.handleClick('link')}>{t('Link')}</a>
            </li>
          </NavTabs>
          {this.state.showModal && actionType && !this.state.pluginLoading && (
            // need the key here so React will re-render
            // with new action prop
            <Modal.Body key={actionType}>
              {plugins.get(plugin).renderGroupActions({
                plugin,
                group: this.props.group,
                project: this.props.project,
                organization: this.props.organization,
                actionType,
                onSuccess: this.closeModal,
              })}
            </Modal.Body>
          )}
        </Modal>
      </React.Fragment>
    );
  }
}

export {PluginActions};

export default withApi(withOrganization(PluginActions));
