import Clip from 'clipboard';
import PropTypes from 'prop-types';
import React from 'react';

import IndicatorStore from '../stores/indicatorStore';

class Clipboard extends React.Component {
  static propTypes = {
    value: PropTypes.string,
    successMessage: PropTypes.string,
    errorMessage: PropTypes.string,
    hideMessages: PropTypes.bool,
    onSuccess: PropTypes.func,
    onError: PropTypes.func
  };

  static defaultProps = {
    hideMessages: false,
    successMessage: 'Copied to clipboard',
    errorMessage: 'Error copying to clipboard'
  };

  componentWillUnmount() {
    if (this.clipboard) {
      this.clipboard.destroy();
    }
  }

  handleMount = ref => {
    if (!ref) return;

    let {hideMessages, successMessage, errorMessage, onSuccess, onError} = this.props;
    let hasSuccessCb = typeof onSuccess === 'function';
    let hasErrorCb = typeof onError === 'function';
    let bindEventHandlers = !hideMessages || hasSuccessCb || hasErrorCb;

    this.clipboard = new Clip(ref, {
      text: () => this.props.value
    });

    if (!bindEventHandlers) return;

    this.clipboard
      .on('success', () => {
        if (!hideMessages) {
          IndicatorStore.add(successMessage, 'success', {duration: 2000});
        }
        if (hasSuccessCb) {
          onSuccess();
        }
      })
      .on('error', () => {
        if (!hideMessages) {
          IndicatorStore.add(errorMessage, 'error', {duration: 2000});
        }
        if (hasErrorCb) {
          onError();
        }
      });
  };

  render() {
    return React.cloneElement(this.props.children, {
      ref: this.handleMount
    });
  }
}

export default Clipboard;
