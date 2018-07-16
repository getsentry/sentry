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
import IssueSyncListElement from 'app/components/issueSyncListElement';

const PluginActions = createReactClass({
  displayName: 'PluginActions',

  propTypes: {
    plugin: PropTypes.object.isRequired,
  },

  mixins: [ApiMixin, GroupState],

  getInitialState() {
    return {
      showModal: false,
      actionType: null,
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

  deleteIssue() {},

  loadPlugin(data) {
    this.setState(
      {
        pluginLoading: true,
      },
      () => {
        plugins.load(data, () => {
          this.setState({pluginLoading: false});
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

  closeModal() {
    this.setState({
      showModal: false,
      actionType: null,
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
    return (
      <React.Fragment>
        <IssueSyncListElement
          openModal={this.openModal}
          onClose={this.deleteIssue}
          integrationType={plugin.name}
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
            <button id="create" onClick={this.handleClick}>
              Create
            </button>
            <button id="link" onClick={this.handleClick}>
              Link
            </button>
          </Modal.Header>
          <Modal.Body>
            {!this.state.pluginLoading &&
              this.state.actionType &&
              plugins.get(this.props.plugin).renderGroupActions({
                plugin: this.props.plugin,
                group: this.getGroup(),
                project: this.getProject(),
                organization: this.getOrganization(),
                actionType: this.state.actionType,
                onSuccess: this.closeModal,
              })}
          </Modal.Body>
        </Modal>
      </React.Fragment>
    );
  },
});

export default PluginActions;
