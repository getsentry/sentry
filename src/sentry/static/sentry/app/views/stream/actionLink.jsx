import Modal from 'react-bootstrap/lib/Modal';
import PureRenderMixin from 'react-addons-pure-render-mixin';
import React from 'react';
import SelectedGroupStore from '../../stores/selectedGroupStore';
import TooltipMixin from '../../mixins/tooltip';
import {t} from '../../locale';

// TODO(mitsuhiko): very unclear how to translate this
const ActionLink = React.createClass({
  propTypes: {
    confirmationQuestion: React.PropTypes.any,
    buttonTitle: React.PropTypes.string,
    canActionAll: React.PropTypes.bool.isRequired,
    confirmLabel: React.PropTypes.any,
    confirmAllLabel: React.PropTypes.any,
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

    let numEvents = SelectedGroupStore.getSelectedIds().size;

    function resolveLabel(obj) {
      if (typeof obj === 'function') {
        return obj(numEvents);
      }
      return obj;
    }

    let confirmationQuestion = resolveLabel(this.props.confirmationQuestion);

    return (
      <a title={this.props.tooltip || this.props.buttonTitle}
         className={className}
         disabled={this.props.disabled}
         onClick={this.handleClick}>
        {this.props.children}

        <Modal show={this.state.isModalOpen} title={t('Please confirm')} animation={false} onHide={this.handleToggle}>
          <div className="modal-body">
            <p><strong>{confirmationQuestion}?</strong></p>
            {this.props.extraDescription &&
              <p>{this.props.extraDescription}</p>
            }
            <p>{t('This action cannot be undone.')}</p>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-default"
                    onClick={this.handleToggle}>{t('Cancel')}</button>
            {this.props.canActionAll &&
              <button type="button" className="btn btn-danger"
                      onClick={this.handleActionAll}>{resolveLabel(this.props.confirmAllLabel)}</button>
            }
            <button type="button" className="btn btn-primary"
                    onClick={this.handleActionSelected}>
              {resolveLabel(this.props.confirmLabel)}
            </button>
          </div>
        </Modal>
      </a>
    );
  }
});

export default ActionLink;

