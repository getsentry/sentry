import React from "react";
import Modal from "react-bootstrap/lib/Modal";
var PureRenderMixin = require('react/addons').addons.PureRenderMixin;

var LinkWithConfirmation = React.createClass({
  mixins: [PureRenderMixin],

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
    this.setState({
      isModalOpen: false
    });

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
      <div>
        <a className={className} disabled={this.props.disabled} onClick={this.onToggle} title={this.props.title}>
          {this.props.children}
        </a>

        <Modal show={this.state.isModalOpen} title="Please confirm" animation={false} onHide={this.onToggle}>
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
      </div>
    );
  }
});

export default LinkWithConfirmation;

