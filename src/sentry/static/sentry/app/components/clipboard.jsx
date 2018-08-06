import Clip from 'clipboard';
import PropTypes from 'prop-types';
import React from 'react';
import ReactDOM from 'react-dom';

import IndicatorStore from 'app/stores/indicatorStore';

class Clipboard extends React.Component {
  static propTypes = {
    value: PropTypes.string,
    successMessage: PropTypes.string,
    errorMessage: PropTypes.string,
    hideMessages: PropTypes.bool,

    /**
     * Hide component if browser does not support "execCommand"
     */
    hideUnsupported: PropTypes.bool,
    onSuccess: PropTypes.func,
    onError: PropTypes.func,
  };

  static defaultProps = {
    hideMessages: false,
    successMessage: 'Copied to clipboard',
    errorMessage: 'Error copying to clipboard',
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

    this.clipboard = new Clip(ReactDOM.findDOMNode(ref), {
      text: () => this.props.value,
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
    let {children, hideUnsupported} = this.props;

    // Browser doesn't support `execCommand`
    if (hideUnsupported && !Clip.isSupported()) {
      return null;
    }

    return React.cloneElement(children, {
      ref: this.handleMount,
    });
  }
}

export default Clipboard;
