import PropTypes from 'prop-types';
import React from 'react';
import createReactClass from 'create-react-class';
import Modal from 'react-bootstrap/lib/Modal';
import ApiMixin from 'app/mixins/apiMixin';
import {addSuccessMessage, addErrorMessage} from 'app/actionCreators/indicator';
import GroupState from 'app/mixins/groupState';
import plugins from 'app/plugins';
import {t} from 'app/locale';
import SentryTypes from 'app/sentryTypes';
import IssueSyncListElement from 'app/components/issueSyncListElement';

const PluginActions = createReactClass({
  displayName: 'PluginActions',

  propTypes: {
    group: SentryTypes.Group.isRequired,
    plugin: PropTypes.object.isRequired,
  },

  mixins: [ApiMixin, GroupState],

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

  ACTION_LABELS: {
    create: t('Create New Issue'),
    link: t('Link with Existing Issue'),
    unlink: t('Unlink Issue'),
  },

  deleteIssue() {
    const plugin = {
      ...this.props.plugin,
      issue: null,
    };
    // override plugin.issue so that 'create/link' Modal
    // doesn't think the plugin still has an issue linked
    const endpoint = `/issues/${this.props.group.id}/plugins/${plugin.slug}/unlink/`;
    this.api.request(endpoint, {
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
          let issue = data.issue || null;
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
      issue: data.id && data.link ? {issue_id: data.id, url: data.link} : null,
      showModal: false,
    });
  },

  handleClick(evt) {
    this.setState({
      actionType: evt.target.id,
    });
  },

  render() {
    const {actionType, issue} = this.state;
    const plugin = {...this.props.plugin, issue};

    return (
      <React.Fragment>
        <IssueSyncListElement
          onOpen={this.openModal}
          externalIssueId={issue ? issue.issue_id : null}
          externalIssueLink={issue ? issue.url : null}
          onClose={this.deleteIssue}
          integrationType={plugin.id}
        />
        <Modal
          show={this.state.showModal}
          onHide={this.closeModal}
          animation={false}
          backdrop="static"
          enforceFocus={false}
        >
          <Modal.Header closeButton>
            <Modal.Title>{`${plugin.name || plugin.title} Issue`}</Modal.Title>
          </Modal.Header>
          <ul
            className="nav nav-tabs"
            style={{borderBottom: '1px solid rgb(221, 221, 221)'}}
          >
            <li className={actionType == 'create' ? 'active' : ''}>
              <a id="create" onClick={this.handleClick}>
                Create
              </a>
            </li>
            <li className={actionType == 'link' ? 'active' : ''}>
              <a id="link" onClick={this.handleClick}>
                Link
              </a>
            </li>
          </ul>
          {this.state.showModal && actionType == 'create' &&
            !this.state.pluginLoading && (
              <Modal.Body>
                {plugins.get(plugin).renderGroupActions({
                  plugin,
                  group: this.getGroup(),
                  project: this.getProject(),
                  organization: this.getOrganization(),
                  actionType: 'create',
                  onSuccess: this.closeModal,
                })}
              </Modal.Body>
            )}
          {this.state.showModal && actionType == 'link' &&
            !this.state.pluginLoading && (
              <Modal.Body>
                {plugins.get(plugin).renderGroupActions({
                  plugin,
                  group: this.getGroup(),
                  project: this.getProject(),
                  organization: this.getOrganization(),
                  actionType: 'link',
                  onSuccess: this.closeModal,
                })}
              </Modal.Body>
            )}
        </Modal>
      </React.Fragment>
    );
  },
});

export default PluginActions;
