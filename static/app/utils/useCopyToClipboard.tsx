import {useCallback, useRef, useState} from 'react';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {t} from 'sentry/locale';

type Opts = {
  /**
   * The text that you want to copy.
   *
   * Use `JSON.stringify()` if you have an object to share.
   *
   * If/When `new ClipboardItem()` accepts a mime type of application/json then
   * it could accept other types, but for now string is the most common case.
   */
  text: string;

  /**
   * The toast message that will appear if an error happens when copying.
   *
   * Disable toast messages by setting the `hideMessages` prop.
   */
  errorMessage?: React.ReactNode;

  /**
   * Disable creating toast messages when copying has succeeded/errored.
   */
  hideMessages?: boolean;

  /**
   * Callback after copying is complete.
   */
  onCopy?: undefined | ((copiedText: string) => void);

  /**
   * Callback if an error happened while copying.
   */
  onError?: undefined | ((error: Error) => void);

  /**
   * The toast messaage that will appear after the copy operation is done.
   *
   * Disable toast messages by setting the `hideMessages` prop.
   */
  successMessage?: React.ReactNode;
};

export default function useCopyToClipboard({
  errorMessage = t('Error copying to clipboard'),
  hideMessages,
  onCopy,
  onError,
  successMessage = t('Copied to clipboard'),
  text,
}: Opts) {
  const timeoutRef = useRef<undefined | ReturnType<typeof setTimeout>>();
  const [state, setState] = useState<'ready' | 'copied' | 'error'>('ready');

  const handleOnClick = useCallback(() => {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        setState('copied');
        if (!hideMessages) {
          addSuccessMessage(successMessage);
        }
        onCopy?.(text);
      })
      .catch(error => {
        setState('error');
        if (!hideMessages) {
          addErrorMessage(errorMessage);
        }
        onError?.(error);
      })
      .finally(() => {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
        timeoutRef.current = setTimeout(() => setState('ready'), 1000);
      });
  }, [errorMessage, hideMessages, onCopy, onError, successMessage, text]);

  const label =
    state === 'ready'
      ? t('Copy')
      : state === 'copied'
      ? t('Copied')
      : t('Unable to copy');

  return {
    onClick: handleOnClick,
    label,
  };
}
