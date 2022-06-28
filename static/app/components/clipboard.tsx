import {cloneElement, isValidElement, useCallback, useEffect, useState} from 'react';
import {findDOMNode} from 'react-dom';
import copy from 'copy-text-to-clipboard';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {t} from 'sentry/locale';

type Props = {
  children: React.ReactNode;
  /**
   * Text to be copied on click
   */
  value: string;
  /**
   * Toast message to show on copy failures
   */
  errorMessage?: string;
  /**
   * Do not show a toast message on success
   */
  hideMessages?: boolean;
  /**
   * Hide children if browser does not support copying
   */
  hideUnsupported?: boolean;
  /**
   * Triggered if we fail to copy
   */
  onError?: () => void;
  /**
   * Trigger if we successfully copy
   */
  onSuccess?: () => void;
  /**
   * Message to show when we successfully copy
   */
  successMessage?: string;
};

/**
 * copy-text-to-clipboard relies on `document.execCommand('copy')`
 */
function isSupported() {
  return !!document.queryCommandSupported?.('copy');
}

function Clipboard({
  hideMessages = false,
  successMessage = t('Copied to clipboard'),
  errorMessage = t('Error copying to clipboard'),
  value,
  onSuccess,
  onError,
  hideUnsupported,
  children,
}: Props) {
  const [element, setElement] = useState<ReturnType<typeof findDOMNode>>();

  const handleClick = useCallback(() => {
    const copyWasSuccessful = copy(value);

    if (!copyWasSuccessful) {
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
  }, [value, onError, onSuccess, errorMessage, successMessage, hideMessages]);

  useEffect(() => {
    element?.addEventListener('click', handleClick);
    return () => element?.removeEventListener('click', handleClick);
  }, [handleClick, element]);

  // XXX: Instead of assigning the `onClick` to the cloned child element, we
  // attach a event listener, otherwise we would wipeout whatever click handler
  // may be assigned on the child.
  const handleMount = useCallback((ref: HTMLElement) => {
    // eslint-disable-next-line react/no-find-dom-node
    setElement(findDOMNode(ref));
  }, []);

  // Browser doesn't support `execCommand`
  if (hideUnsupported && !isSupported()) {
    return null;
  }

  if (!isValidElement(children)) {
    return null;
  }

  return cloneElement(children, {ref: handleMount});
}

export default Clipboard;
