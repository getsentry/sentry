import {createContext, Fragment, useContext, useState} from 'react';
import {Theme} from '@emotion/react';

import {Alert} from 'sentry/components/alert';

export type PageAlertOptions = {
  message: string | undefined;
  type: keyof Theme['alert'];
};

const pageErrorContext = createContext<{
  setPageError: (message: string | undefined) => void;
  setPageInfo: (message: string | undefined) => void;
  setPageMuted: (message: string | undefined) => void;
  setPageSuccess: (message: string | undefined) => void;
  setPageWarning: (message: string | undefined) => void;
  pageAlert?: PageAlertOptions;
}>({
  pageAlert: undefined,
  setPageError: (_: string | undefined) => {},
  setPageInfo: (_: string | undefined) => {},
  setPageMuted: (_: string | undefined) => {},
  setPageSuccess: (_: string | undefined) => {},
  setPageWarning: (_: string | undefined) => {},
});

export function PageAlertProvider({children}: {children: React.ReactNode}) {
  const [pageAlert, setPageAlert] = useState<PageAlertOptions | undefined>();

  const setPageInfo = (message: string | undefined) => {
    setPageAlert({message, type: 'info'});
  };
  const setPageMuted = (message: string | undefined) => {
    setPageAlert({message, type: 'muted'});
  };

  const setPageSuccess = (message: string | undefined) => {
    setPageAlert({message, type: 'success'});
  };

  const setPageWarning = (message: string | undefined) => {
    setPageAlert({message, type: 'warning'});
  };

  const setPageError = (message: string | undefined) => {
    setPageAlert({message, type: 'error'});
  };

  return (
    <pageErrorContext.Provider
      value={{
        pageAlert,
        setPageInfo,
        setPageMuted,
        setPageSuccess,
        setPageWarning,
        setPageError,
      }}
    >
      {children}
    </pageErrorContext.Provider>
  );
}

export function PageAlert() {
  const {pageAlert: pageError} = useContext(pageErrorContext);
  if (!pageError || !pageError.message) {
    return null;
  }

  const isStringError = typeof pageError === 'string';
  const message = isStringError ? pageError : pageError.message;

  return (
    <Alert type={pageError.type} data-test-id="page-error-alert" showIcon>
      <Fragment>{message}</Fragment>
    </Alert>
  );
}

export const usePageAlert = () => useContext(pageErrorContext);
