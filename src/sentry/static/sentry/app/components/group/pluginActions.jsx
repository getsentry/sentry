import PropTypes from 'prop-types';
import React from 'react';
import createReactClass from 'create-react-class';
import Modal from 'react-bootstrap/lib/Modal';
import ApiMixin from 'app/mixins/apiMixin';
import DropdownLink from 'app/components/dropdownLink';
import GroupState from 'app/mixins/groupState';
import MenuItem from 'app/components/menuItem';
import plugins from 'app/plugins';
import {t} from 'app/locale';
import {toTitleCase} from 'app/utils';
import styled from 'react-emotion';
import space from 'app/styles/space';
import IssueSyncListElement from 'app/components/issueSyncListElement';

const PluginActions = createReactClass({
  displayName: 'PluginActions',

  propTypes: {
    group: PropTypes.object.isRequired,
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

  componentWillMount() {
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
    const endpoint = `/issues/${this.props.group.id}/plugins/${this.props.plugin
      .slug}/unlink/`;
    this.api.request(endpoint, {
      success: data => {
        this.setState({
          issue: null,
          error: null,
        });
      },
      error: error => {},
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
      showModal: false,
      actionType: null,
    });
  },

  handleClick(evt) {
    this.setState({
      actionType: evt.target.id,
    });
  },

  render() {
    let plugin = this.props.plugin;

    if (!plugin.allowed_actions || !plugin.allowed_actions.length) {
      return null;
    }

    let allowedActions = plugin.allowed_actions.filter(
      plugin.issue ? action => action === 'unlink' : action => action !== 'unlink'
    );

    let button;
    if (allowedActions.length === 1) {
      // # TODO(dcramer): remove plugin.title check in Sentry 8.22+
      button = (
        <button
          className={'btn btn-default btn-sm btn-plugin-' + plugin.slug}
          onClick={this.openModal.bind(this, allowedActions[0])}
        >
          {toTitleCase(allowedActions[0]) +
            ' ' +
            (plugin.shortName || plugin.name || plugin.title) +
            ' Issue'}
        </button>
      );
    } else {
      // # TODO(dcramer): remove plugin.title check in Sentry 8.22+
      button = (
        <div className={'btn-plugin-' + plugin.slug}>
          <DropdownLink
            caret={false}
            className="btn btn-default btn-sm"
            title={
              <span style={{display: 'flex'}}>
                {plugin.shortName || plugin.name || plugin.title}
                <span
                  className="icon-arrow-down"
                  style={{marginLeft: 3, marginRight: -3}}
                />
              </span>
            }
          >
            {allowedActions.map(action => {
              return (
                <MenuItem key={action} noAnchor={true}>
                  <a onClick={this.openModal.bind(this, action)}>
                    {this.ACTION_LABELS[action]}
                  </a>
                </MenuItem>
              );
            })}
          </DropdownLink>
        </div>
      );
    }

    // # TODO(dcramer): remove plugin.title check in Sentry 8.22+
    const {actionType, issue} = this.state;
    return (
      <React.Fragment>
        <IssueSyncListElement
          openModal={this.openModal}
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
          {actionType == 'create' && (
            <React.Fragment>
              <ActiveActionButton id="create" onClick={this.handleClick}>
                Create
              </ActiveActionButton>
              <ActionButton id="link" onClick={this.handleClick}>
                Link
              </ActionButton>
            </React.Fragment>
          )}
          {actionType == 'link' && (
            <React.Fragment>
              <ActionButton id="create" onClick={this.handleClick}>
                Create
              </ActionButton>
              <ActiveActionButton id="link" onClick={this.handleClick}>
                Link
              </ActiveActionButton>
            </React.Fragment>
          )}
          {actionType == 'create' &&
            !this.state.pluginLoading && (
              <Modal.Body>
                {plugins.get(this.props.plugin).renderGroupActions({
                  plugin: this.props.plugin,
                  group: this.getGroup(),
                  project: this.getProject(),
                  organization: this.getOrganization(),
                  actionType,
                  onSuccess: this.closeModal,
                })}
              </Modal.Body>
            )}
          {actionType == 'link' &&
            !this.state.pluginLoading && (
              <Modal.Body>
                {plugins.get(this.props.plugin).renderGroupActions({
                  plugin: this.props.plugin,
                  group: this.getGroup(),
                  project: this.getProject(),
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

const ActionButton = styled('span')`
  margin-right: ${space(1)};
  border: none;
  padding: ${space(1)} ${space(1.5)};
  top: ${space(-10)};
`;

const ActiveActionButton = styled('div')`
  margin: 0 ${space(1)} ${space(2)} 0;
  border: none;
  padding: 0 ${space(1)} ${space(1)} ${space(1)};
  display: inline-block;
  border-bottom: 4px solid ${p => p.theme.purple};
`;

export default PluginActions;
