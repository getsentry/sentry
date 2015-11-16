import Modal from 'react-bootstrap/lib/Modal';
import PureRenderMixin from 'react-addons-pure-render-mixin';
import React from 'react';
import SelectedGroupStore from '../../stores/selectedGroupStore';
import TooltipMixin from '../../mixins/tooltip';

const ActionLink = React.createClass({
  propTypes: {
    actionLabel: React.PropTypes.string,
    canActionAll: React.PropTypes.bool.isRequired,
    confirmLabel: React.PropTypes.string,
    disabled: React.PropTypes.bool,
    neverConfirm: React.PropTypes.bool,
    onAction: React.PropTypes.func.isRequired,
    onlyIfBulk: React.PropTypes.bool,
    selectAllActive: React.PropTypes.bool.isRequired
  },

  mixins: [
    PureRenderMixin,
    TooltipMixin({
      html: false,
      container: 'body'
    })
  ],

  getDefaultProps() {
    return {
      actionTypes: {},
      buttonTitle: null, // title="..." (optional)
      canActionAll: false,
      confirmLabel: 'Edit',
      onlyIfBulk: false,
      neverConfirm: false,
      disabled: false
    };
  },

  getInitialState() {
    return {
      isModalOpen: false
    };
  },

  handleClick() {
    let selectedItemIds = SelectedGroupStore.getSelectedIds();
    if (!this.state.isModalOpen && !this.shouldConfirm(selectedItemIds.size)) {
      return void this.handleActionSelected();
    }

    this.handleToggle();
  },

  handleToggle() {
    if (this.props.disabled) {
      return;
    }
    this.setState({
      isModalOpen: !this.state.isModalOpen
    });
  },

  handleActionAll(evt) {
    this.props.onAction(evt, this.props.actionTypes.ALL);
    this.setState({
      isModalOpen: false
    });
  },

  handleActionSelected(evt) {
    this.props.onAction(evt, this.props.actionTypes.SELECTED);
    this.setState({
      isModalOpen: false
    });
  },

  defaultActionLabel(confirmLabel) {
    return confirmLabel.toLowerCase() + ' these {count} events';
  },

  shouldConfirm(numSelectedItems) {
    // By default, should confirm ...
    let shouldConfirm = true;

    // Unless `neverConfirm` is true, then return false
    if (this.props.neverConfirm === true) {
      shouldConfirm = false;

    // Unless `onlyIfBulk` is true, then return false if all items are not selected
    } else if (this.props.onlyIfBulk === true && (!this.props.selectAllActive || numSelectedItems === 1)) {
      shouldConfirm = false;
    }

    return shouldConfirm;
  },

  render() {
    let className = this.props.className;
    if (this.props.disabled) {
      className += ' disabled';
    }
    className += ' tip';


    let confirmLabel = this.props.confirmLabel;
    let numEvents = SelectedGroupStore.getSelectedIds().size;
    let actionLabel = this.props.actionLabel || this.defaultActionLabel(confirmLabel);
    actionLabel = actionLabel.replace('{count}', numEvents);

    return (
      <a title={this.props.tooltip || this.props.buttonTitle}
         className={className}
         disabled={this.props.disabled}
         onClick={this.handleClick}>
        {this.props.children}

        <Modal show={this.state.isModalOpen} title="Please confirm" animation={false} onHide={this.handleToggle}>
          <div className="modal-body">
            <p><strong>Are you sure that you want to {actionLabel}?</strong></p>
            {this.props.extraDescription &&
              <p>{this.props.extraDescription}</p>
            }
            <p>This action cannot be undone.</p>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-default"
                    onClick={this.handleToggle}>Cancel</button>
            {this.props.canActionAll &&
              <button type="button" className="btn btn-danger"
                      onClick={this.handleActionAll}>{confirmLabel} all recorded events</button>
            }
            <button type="button" className="btn btn-primary"
                    onClick={this.handleActionSelected}>
              {numEvents !== 0 ?
                `${confirmLabel} ${numEvents} selected events`
              :
                confirmLabel
              }
            </button>
          </div>
        </Modal>
      </a>
    );
  }
});

export default ActionLink;

