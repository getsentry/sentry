import React from 'react';
import copy from 'copy-text-to-clipboard';

import {addErrorMessage, addSuccessMessage} from 'app/actionCreators/indicator';

type Props = {
  children: React.ReactElement<{onClick: () => void}>;
  value: string;
  successMessage?: string;
  errorMessage?: string;
  hideMessages?: boolean;
  hideUnsupported?: boolean;
  onSuccess?: () => void;
  onError?: () => void;
};

/**
 * copy-text-to-clipboard relies on `document.execCommand('copy')`
 */
function isSupported() {
  const support = !!document.queryCommandSupported;
  return support && !!document.queryCommandSupported('copy');
}

function Clipboard({
  children,
  value,
  successMessage = 'Copied to clipboard',
  errorMessage = 'Error copying to clipboard',
  hideMessages = false,
  hideUnsupported,
  onSuccess,
  onError,
}: Props) {
  function handleClick() {
    // Copy returns whether it succeeded to copy the text
    const success = copy(value);
    if (success) {
      if (!hideMessages) {
        addSuccessMessage(successMessage);
      }
      onSuccess?.();
    } else {
      if (!hideMessages) {
        addErrorMessage(errorMessage);
      }
      onError?.();
    }
  }

  if (hideUnsupported && !isSupported()) {
    return null;
  }

  if (!React.isValidElement(children)) {
    return null;
  }

  return React.cloneElement(children, {
    onClick: () => handleClick(),
  });
}

export default Clipboard;
