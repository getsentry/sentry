import React from 'react';
import Modal from 'react-bootstrap/lib/Modal';
import ApiMixin from '../../mixins/apiMixin';
import DropdownLink from '../../components/dropdownLink';
import GroupState from '../../mixins/groupState';
import MenuItem from '../../components/menuItem';
import plugins from '../../plugins';
import {t} from '../../locale';
import {toTitleCase} from '../../utils';


const IssuePluginActions = React.createClass({
  propTypes: {
    plugin: React.PropTypes.object.isRequired
  },

  mixins: [
    ApiMixin,
    GroupState
  ],

  getInitialState() {
    return {
      showModal: false,
      actionType: null,
      pluginLoading: false
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
    unlink: t('Unlink Issue')
  },

  loadPlugin(data) {
    this.setState({
      pluginLoading: true,
    }, () => {
      plugins.load(data, () => {
        this.setState({pluginLoading: false});
      });
    });
  },

  openModal(action) {
    this.setState({
      showModal: true,
      actionType: action
    });
  },

  closeModal() {
    this.setState({
      showModal: false,
      actionType: null
    });
  },

  render() {
    let plugin = this.props.plugin;

    if (!plugin.allowed_actions || !plugin.allowed_actions.length) {
      return null;
    }

    let allowedActions = plugin.allowed_actions.filter(
      plugin.issue
        ? action => action === 'unlink'
        : action => action !== 'unlink'
    );

    let button;
    if (allowedActions.length === 1) {
      button = (
        <button className={'btn btn-default btn-sm btn-plugin-' + plugin.slug}
                onClick={this.openModal.bind(this, allowedActions[0])}>
          {toTitleCase(allowedActions[0]) + ' ' + plugin.title + ' Issue'}
        </button>
      );
    } else {
      button = (
        <div className={'btn-group btn-plugin-' + plugin.slug}>
          <DropdownLink
            caret={false}
            className="btn btn-default btn-sm"
            title={<span>
                     {plugin.title}
                     <span className="icon-arrow-down" style={{marginLeft: 3, marginRight: -3}} />
                   </span>}>
            {allowedActions.map(action => {
              return (
                <MenuItem key={action} noAnchor={true}>
                  <a onClick={this.openModal.bind(this, action)}>{this.ACTION_LABELS[action]}</a>
                </MenuItem>
              );
            })}
          </DropdownLink>
        </div>
      );
    }

    return (
      <span>
        {button}
        <Modal show={this.state.showModal} onHide={this.closeModal}
               animation={false} backdrop="static" enforceFocus={false}>
          <Modal.Header closeButton>
            <Modal.Title>{plugin.title + ' Issue'}</Modal.Title>
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
                    onSuccess: this.closeModal
                })
            }
          </Modal.Body>
        </Modal>
      </span>
    );
  }
});

export default IssuePluginActions;
