import {cloneElement, Component, isValidElement} from 'react';
import {findDOMNode} from 'react-dom';
import copy from 'copy-text-to-clipboard';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {t} from 'sentry/locale';

type DefaultProps = {
  errorMessage: string;
  hideMessages: boolean;
  successMessage: string;
};

type Props = {
  /** Text to be copied on click */
  value: string;
  /** Hide children if browser does not support copy */
  hideUnsupported?: boolean;
  onError?: () => void;
  onSuccess?: () => void;
} & DefaultProps;

/**
 * copy-text-to-clipboard relies on `document.execCommand('copy')`
 */
function isSupported() {
  const support = !!document.queryCommandSupported;
  return support && !!document.queryCommandSupported('copy');
}

class Clipboard extends Component<Props> {
  static defaultProps: DefaultProps = {
    hideMessages: false,
    successMessage: t('Copied to clipboard'),
    errorMessage: t('Error copying to clipboard'),
  };

  componentWillUnmount() {
    this.element?.removeEventListener('click', this.handleClick);
  }

  element?: ReturnType<typeof findDOMNode>;

  handleClick = () => {
    const {value, hideMessages, successMessage, errorMessage, onSuccess, onError} =
      this.props;
    // Copy returns whether it succeeded to copy the text
    const success = copy(value);
    if (!success) {
      if (!hideMessages) {
        addErrorMessage(errorMessage);
      }
      onError?.();
      return;
    }

    if (!hideMessages) {
      addSuccessMessage(successMessage);
    }
    onSuccess?.();
  };

  handleMount = (ref: HTMLElement) => {
    if (!ref) {
      return;
    }

    // eslint-disable-next-line react/no-find-dom-node
    this.element = findDOMNode(ref);
    this.element?.addEventListener('click', this.handleClick);
  };

  render() {
    const {children, hideUnsupported} = this.props;

    // Browser doesn't support `execCommand`
    if (hideUnsupported && !isSupported()) {
      return null;
    }

    if (!isValidElement(children)) {
      return null;
    }

    return cloneElement(children, {
      ref: this.handleMount,
    });
  }
}

export default Clipboard;
