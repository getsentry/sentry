import React from 'react';
import Modal from 'react-bootstrap/lib/Modal';
import PureRenderMixin from 'react-addons-pure-render-mixin';
import {t} from '../locale';

const LinkWithConfirmation = React.createClass({
  propTypes: {
    disabled: React.PropTypes.bool,
    message: React.PropTypes.string.isRequired,
    title: React.PropTypes.string.isRequired,
    onConfirm: React.PropTypes.func.isRequired
  },

  mixins: [PureRenderMixin],

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
    let className = this.props.className;
    if (this.props.disabled) {
      className += ' disabled';
    }
    return (
      <a className={className} disabled={this.props.disabled} onClick={this.onToggle} title={this.props.title}>
        {this.props.children}
        <Modal show={this.state.isModalOpen} title={t('Please confirm')} animation={false} onHide={this.onToggle}>
          <div className="modal-body">
            <p><strong>{this.props.message}</strong></p>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-default"
                    onClick={this.onToggle}>{t('Cancel')}</button>
            <button type="button" className="btn btn-primary"
                    onClick={this.onConfirm}>{t('Confirm')}</button>
          </div>
        </Modal>
      </a>
    );
  }
});

export default LinkWithConfirmation;
