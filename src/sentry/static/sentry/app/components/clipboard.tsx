import Clip from 'clipboard';
import PropTypes from 'prop-types';
import React from 'react';
import ReactDOM from 'react-dom';

import {addErrorMessage, addSuccessMessage} from 'app/actionCreators/indicator';

type DefaultProps = {
  successMessage: string;
  errorMessage: string;
  hideMessages: boolean;
};

type Props = {
  value: string;
  hideUnsupported?: boolean;
  onSuccess?: () => void;
  onError?: () => void;
} & DefaultProps;

class Clipboard extends React.Component<Props> {
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

  static defaultProps: DefaultProps = {
    hideMessages: false,
    successMessage: 'Copied to clipboard',
    errorMessage: 'Error copying to clipboard',
  };

  componentWillUnmount() {
    if (this.clipboard) {
      this.clipboard.destroy();
    }
  }

  clipboard!: ClipboardJS;

  handleMount = (ref: HTMLElement) => {
    if (!ref) {
      return;
    }

    const {hideMessages, successMessage, errorMessage, onSuccess, onError} = this.props;
    const hasSuccessCb = typeof onSuccess === 'function';
    const hasErrorCb = typeof onError === 'function';
    const bindEventHandlers = !hideMessages || hasSuccessCb || hasErrorCb;

    // eslint-disable-next-line react/no-find-dom-node
    this.clipboard = new Clip(ReactDOM.findDOMNode(ref) as Element, {
      text: () => this.props.value,
    });

    if (!bindEventHandlers) {
      return;
    }

    this.clipboard
      .on('success', () => {
        if (!hideMessages) {
          addSuccessMessage(successMessage);
        }
        if (onSuccess && hasSuccessCb) {
          onSuccess();
        }
      })
      .on('error', () => {
        if (!hideMessages) {
          addErrorMessage(errorMessage);
        }
        if (onError && hasErrorCb) {
          onError();
        }
      });
  };

  render() {
    const {children, hideUnsupported} = this.props;

    // Browser doesn't support `execCommand`
    if (hideUnsupported && !Clip.isSupported()) {
      return null;
    }

    if (!React.isValidElement(children)) {
      return null;
    }

    return React.cloneElement(children, {
      ref: this.handleMount,
    });
  }
}

export default Clipboard;
