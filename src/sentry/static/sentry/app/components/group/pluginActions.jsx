import PropTypes from 'prop-types';
import React from 'react';
import createReactClass from 'create-react-class';
import Modal from 'react-bootstrap/lib/Modal';
import withApi from 'app/utils/withApi';
import {addSuccessMessage, addErrorMessage} from 'app/actionCreators/indicator';
import OrganizationState from 'app/mixins/organizationState';
import NavTabs from 'app/components/navTabs';
import plugins from 'app/plugins';
import {t} from 'app/locale';
import SentryTypes from 'app/sentryTypes';
import IssueSyncListElement from 'app/components/issueSyncListElement';

const PluginActions = createReactClass({
  displayName: 'PluginActions',

  propTypes: {
    api: PropTypes.object,
    group: SentryTypes.Group.isRequired,
    project: SentryTypes.Project.isRequired,
    plugin: PropTypes.object.isRequired,
  },

  mixins: [OrganizationState],

  getInitialState() {
    return {
      showModal: false,
      actionType: null,
      issue: null,
      pluginLoading: false,
    };
  },

  componentDidMount() {
    this.loadPlugin(this.props.plugin);
  },

  componentWillReceiveProps(nextProps) {
    if (this.props.plugin.id !== nextProps.plugin.id) {
      this.loadPlugin(nextProps.plugin);
    }
  },

  deleteIssue() {
    const plugin = {
      ...this.props.plugin,
      issue: null,
    };
    // override plugin.issue so that 'create/link' Modal
    // doesn't think the plugin still has an issue linked
    const endpoint = `/issues/${this.props.group.id}/plugins/${plugin.slug}/unlink/`;
    this.props.api.request(endpoint, {
      success: data => {
        this.loadPlugin(plugin);
        addSuccessMessage(t('Successfully unlinked issue.'));
      },
      error: error => {
        addErrorMessage(t('Unable to unlink issue'));
      },
    });
  },

  loadPlugin(data) {
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
  },

  openModal() {
    this.setState({
      showModal: true,
      actionType: 'create',
    });
  },

  closeModal(data) {
    this.setState({
      issue:
        data && data.id && data.link
          ? {issue_id: data.id, url: data.link, label: data.label}
          : null,
      showModal: false,
    });
  },

  handleClick(actionType) {
    this.setState({actionType});
  },

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
            <Modal.Title>{`${plugin.name || plugin.title} Issue`}</Modal.Title>
          </Modal.Header>
          <NavTabs underlined={true}>
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
                organization: this.getOrganization(),
                actionType,
                onSuccess: this.closeModal,
              })}
            </Modal.Body>
          )}
        </Modal>
      </React.Fragment>
    );
  },
});

export {PluginActions};

export default withApi(PluginActions);
