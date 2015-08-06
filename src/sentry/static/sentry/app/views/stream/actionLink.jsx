import Modal from "react-bootstrap/Modal";
import OverlayMixin from "react-bootstrap/OverlayMixin";
var PureRenderMixin = require('react/addons').addons.PureRenderMixin;
import React from "react";
import SelectedGroupStore from "../../stores/selectedGroupStore";

var ActionLink = React.createClass({
  mixins: [OverlayMixin, PureRenderMixin],

  propTypes: {
    actionLabel: React.PropTypes.string,
    groupIds: React.PropTypes.instanceOf(Array).isRequired,
    canActionAll: React.PropTypes.bool.isRequired,
    confirmLabel: React.PropTypes.string,
    disabled: React.PropTypes.bool,
    neverConfirm: React.PropTypes.bool,
    onAction: React.PropTypes.func.isRequired,
    onlyIfBulk: React.PropTypes.bool,
    selectAllActive: React.PropTypes.bool.isRequired
  },

  getDefaultProps() {
    return {
      actionTypes: {},
      buttonTitle: null, // title="..." (optional)
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

  handleToggle() {
    if (this.props.disabled) {
      return;
    }
    this.setState({
      isModalOpen: !this.state.isModalOpen
    });
  },

  handleActionAll(event) {
    this.props.onAction(event, this.props.actionTypes.ALL);
    this.setState({
      isModalOpen: false
    });
  },

  handleActionSelected(event) {
    this.props.onAction(event, this.props.actionTypes.SELECTED);
    this.setState({
      isModalOpen: false
    });
  },

  defaultActionLabel(confirmLabel) {
    return confirmLabel.toLowerCase() + ' these {count} events';
  },

  render() {
    var className = this.props.className;
    if (this.props.disabled) {
      className += ' disabled';
    }
    return (
      <a title={this.props.buttonTitle} className={className} disabled={this.props.disabled} onClick={this.handleToggle}>
        {this.props.children}
      </a>
    );
  },

  renderOverlay() {
    if (!this.state.isModalOpen) {
      return null;
    }

    var selectedItemIds = SelectedGroupStore.getSelectedIds();
    if (selectedItemIds.size === 0) {
      throw new Error('ActionModal rendered without any selected groups');
    }

    var shouldConfirm = true;
    // if skipConfirm is set we never actually show the modal
    if (this.props.neverConfirm === true) {
      shouldConfirm = false;
    // if onlyIfBulk is set and we've selected a single item, we skip
    // showing the modal
    } else if (this.props.onlyIfBulk === true && !this.props.selectAllActive) {
      shouldConfirm = false;
    }

    if (!shouldConfirm) {
      this.handleActionSelected();
      this.state.isModalOpen = false;
      return null;
    }

    var confirmLabel = this.props.confirmLabel;
    var actionLabel = this.props.actionLabel || this.defaultActionLabel(confirmLabel);
    var numEvents = selectedItemIds.size;

    actionLabel = actionLabel.replace('{count}', numEvents);

    return (
      <Modal title="Please confirm" animation={false} onRequestHide={this.handleToggle}>
        <div className="modal-body">
          <p><strong>Are you sure that you want to {actionLabel}?</strong></p>
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
                  onClick={this.handleActionSelected}>{confirmLabel} {numEvents} selected events</button>
        </div>
      </Modal>
    );
  }
});

export default ActionLink;

