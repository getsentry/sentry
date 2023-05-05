import {useCallback, useRef, useState} from 'react';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {t} from 'sentry/locale';

type Opts = {
  text: string;
  errorMessage?: string;
  hideMessages?: boolean;
  onCopy?: undefined | ((copiedText: string) => void);
  onError?: undefined | ((error: Error) => void);
  successMessage?: string;
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
