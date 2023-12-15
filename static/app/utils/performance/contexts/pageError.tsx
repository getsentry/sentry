import {createContext, Fragment, useContext, useRef, useState} from 'react';
import {Theme} from '@emotion/react';

import {Alert} from 'sentry/components/alert';
import {IconClose} from 'sentry/icons';

export type PageAlertOptions = {
  message: string | undefined;
  type: keyof Theme['alert'];
  dismissible?: boolean;
};

const pageErrorContext = createContext<{
  dismissedPageErrors: Set<string>;
  setPageAlert: (error: PageAlertOptions | undefined) => void;
  pageAlert?: PageAlertOptions;
}>({
  pageAlert: undefined,
  setPageAlert: (_: PageAlertOptions | undefined) => {},
  dismissedPageErrors: new Set(),
});

export function PageAlertProvider({children}: {children: React.ReactNode}) {
  const [pageError, setPageError] = useState<PageAlertOptions | undefined>();
  const {current: currentDismissedErrors} = useRef<Set<string>>(new Set());

  return (
    <pageErrorContext.Provider
      value={{
        pageAlert: pageError,
        setPageAlert: setPageError,
        dismissedPageErrors: currentDismissedErrors,
      }}
    >
      {children}
    </pageErrorContext.Provider>
  );
}

export function PageAlert() {
  const {
    pageAlert: pageError,
    setPageAlert,
    dismissedPageErrors,
  } = useContext(pageErrorContext);
  if (!pageError || !pageError.message) {
    return null;
  }

  const isStringError = typeof pageError === 'string';
  const type = isStringError ? 'error' : pageError.type;
  const message = isStringError ? pageError : pageError.message;

  if (dismissedPageErrors?.has(message)) {
    return null;
  }
  dismissedPageErrors?.add(message);

  const handleDismiss = () => {
    setPageAlert(undefined);
  };

  return (
    <Alert
      type={type}
      data-test-id="page-error-alert"
      showIcon
      trailingItems={
        !isStringError &&
        pageError.dismissible && <IconClose size="sm" onClick={handleDismiss} />
      }
    >
      <Fragment>{message}</Fragment>
    </Alert>
  );
}

export const usePageAlert = () => useContext(pageErrorContext);
