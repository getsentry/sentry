import Modal from 'react-bootstrap/lib/Modal';
import PureRenderMixin from 'react-addons-pure-render-mixin';
import PropTypes from 'prop-types';
import React from 'react';
import _ from 'lodash';

import SelectedGroupStore from '../../stores/selectedGroupStore';
import TooltipMixin from '../../mixins/tooltip';
import {t} from '../../locale';

// TODO(mitsuhiko): very unclear how to translate this
const ActionLink = React.createClass({
  propTypes: {
    confirmationQuestion: PropTypes.any,
    buttonTitle: PropTypes.string,
    confirmLabel: PropTypes.any,
    disabled: PropTypes.bool,
    onAction: PropTypes.func.isRequired,
    onlyIfBulk: PropTypes.bool,
    selectAllActive: PropTypes.bool.isRequired, // "select all" checkbox
    tooltip: PropTypes.string,
    extraDescription: PropTypes.node
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
      buttonTitle: null, // title="..." (optional)
      onlyIfBulk: false,
      disabled: false,
      extraDescription: null
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
      return void this.handleAction();
    }
    return void this.handleToggle();
  },

  handleToggle() {
    if (this.props.disabled) {
      return;
    }
    this.setState({
      isModalOpen: !this.state.isModalOpen
    });
  },

  handleAction(evt) {
    this.props.onAction(evt);
    this.setState({
      isModalOpen: false
    });
  },

  shouldConfirm(numSelectedItems) {
    // By default, should confirm ...
    let shouldConfirm = true;

    // Unless `onlyIfBulk` is true, then return false if all items are not selected
    if (
      this.props.onlyIfBulk === true &&
      (!this.props.selectAllActive || numSelectedItems === 1)
    ) {
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
      if (_.isFunction(obj)) {
        return obj(numEvents);
      }
      return obj;
    }

    let confirmationQuestion = resolveLabel(this.props.confirmationQuestion);

    return (
      <a
        title={this.props.tooltip !== null ? this.props.tooltip : this.props.buttonTitle}
        className={className}
        disabled={this.props.disabled}
        onClick={this.handleClick}
        data-placement="bottom">
        {this.props.children}

        <Modal
          show={this.state.isModalOpen}
          title={t('Please confirm')}
          animation={false}
          onHide={this.handleToggle}>
          <div className="modal-body">
            <p><strong>{confirmationQuestion}</strong></p>
            {this.props.extraDescription}
            <p>{t('This action cannot be undone.')}</p>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-default" onClick={this.handleToggle}>
              {t('Cancel')}
            </button>
            <button type="button" className="btn btn-primary" onClick={this.handleAction}>
              {resolveLabel(this.props.confirmLabel)}
            </button>
          </div>
        </Modal>
      </a>
    );
  }
});

export default ActionLink;
