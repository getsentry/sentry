import React from "react";
import Modal from "react-bootstrap/Modal";
import OverlayMixin from "react-bootstrap/OverlayMixin";
var PureRenderMixin = require('react/addons').addons.PureRenderMixin;

var LinkWithConfirmation = React.createClass({
  mixins: [OverlayMixin, PureRenderMixin],

  propTypes: {
    disabled: React.PropTypes.bool,
    message: React.PropTypes.string.isRequired,
    onConfirm: React.PropTypes.func.isRequired
  },

  getInitialState() {
    return {
      isModalOpen: false
    };
  },

  onConfirm() {
    this.props.onConfirm();
  },

  onToggle() {
    if (this.props.disabled) {
      return;
    }
    this.setState({
      isModalOpen: !this.state.isModalOpen
    });
  },

  render() {
    var className = this.props.className;
    if (this.props.disabled) {
      className += ' disabled';
    }
    return (
      <a className={className} disabled={this.props.disabled} onClick={this.onToggle} title={this.props.title}>
        {this.props.children}
      </a>
    );
  },

  renderOverlay() {
    if (!this.state.isModalOpen) {
      return <span/>;
    }

    return (
      <Modal title="Please confirm" animation={false} onRequestHide={this.onToggle}>
        <div className="modal-body">
          <p><strong>{this.props.message}</strong></p>
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-default"
                  onClick={this.onToggle}>Cancel</button>
          <button type="button" className="btn btn-primary"
                  onClick={this.onConfirm}>Confirm</button>
        </div>
      </Modal>
    );
  }
});

export default LinkWithConfirmation;

