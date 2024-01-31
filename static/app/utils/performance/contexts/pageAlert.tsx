import type React from 'react';
import {createContext, Fragment, useContext, useState} from 'react';
import type {Theme} from '@emotion/react';

import {Alert} from 'sentry/components/alert';

type PageAlertType = keyof Theme['alert'];

export type PageAlertOptions = {
  message: React.ReactNode | undefined;
  type: PageAlertType;
};

type PageAlertSetter = (message: React.ReactNode | undefined) => void;

const pageErrorContext = createContext<{
  setPageError: PageAlertSetter;
  setPageInfo: PageAlertSetter;
  setPageMuted: PageAlertSetter;
  setPageSuccess: PageAlertSetter;
  setPageWarning: PageAlertSetter;
  pageAlert?: PageAlertOptions;
}>({
  pageAlert: undefined,
  setPageError: (_: React.ReactNode | undefined) => {},
  setPageInfo: (_: React.ReactNode | undefined) => {},
  setPageMuted: (_: React.ReactNode | undefined) => {},
  setPageSuccess: (_: React.ReactNode | undefined) => {},
  setPageWarning: (_: React.ReactNode | undefined) => {},
});

export function PageAlertProvider({children}: {children: React.ReactNode}) {
  const [pageAlert, setPageAlert] = useState<PageAlertOptions | undefined>();

  const setPageInfo: PageAlertSetter = message => {
    setPageAlert({message, type: 'info'});
  };
  const setPageMuted: PageAlertSetter = message => {
    setPageAlert({message, type: 'muted'});
  };

  const setPageSuccess: PageAlertSetter = message => {
    setPageAlert({message, type: 'success'});
  };

  const setPageWarning: PageAlertSetter = message => {
    setPageAlert({message, type: 'warning'});
  };

  const setPageError: PageAlertSetter = message => {
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
  const {pageAlert} = useContext(pageErrorContext);
  if (!pageAlert || !pageAlert.message) {
    return null;
  }

  const isStringError = typeof pageAlert === 'string';
  const message = isStringError ? pageAlert : pageAlert.message;

  return (
    <Alert type={pageAlert.type} data-test-id="page-error-alert" showIcon>
      <Fragment>{message}</Fragment>
    </Alert>
  );
}

export const usePageAlert = () => useContext(pageErrorContext);
