import type React from 'react';
import {createContext, Fragment, useContext, useState} from 'react';
import type {Theme} from '@emotion/react';

import {Alert} from 'sentry/components/alert';
import {IconClose} from 'sentry/icons';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';

type PageAlertType = keyof Theme['alert'];

export enum DismissId {
  RESOURCE_SIZE_ALERT,
}

export type PageAlertOptions = {
  message: React.ReactNode | undefined;
  type: PageAlertType;
  dismissId?: DismissId;
};

const localStorageKey = 'sentry:page-alert';

type PageAlertSetter = (
  message: React.ReactNode | undefined,
  options?: Pick<PageAlertOptions, 'dismissId'>
) => void;

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

  const setPageInfo: PageAlertSetter = (message, options) => {
    setPageAlert({message, type: 'info', ...options});
  };
  const setPageMuted: PageAlertSetter = (message, options) => {
    setPageAlert({message, type: 'muted', ...options});
  };

  const setPageSuccess: PageAlertSetter = (message, options) => {
    setPageAlert({message, type: 'success', ...options});
  };

  const setPageWarning: PageAlertSetter = (message, options) => {
    setPageAlert({message, type: 'warning', ...options});
  };

  const setPageError: PageAlertSetter = (message, options) => {
    setPageAlert({message, type: 'error', ...options});
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
  const [dismissedAlerts, setDismissedAlerts] = useLocalStorageState<string[]>(
    localStorageKey,
    []
  );

  if (!pageAlert || !pageAlert.message) {
    return null;
  }

  const {message, dismissId} = pageAlert;

  if (dismissId && dismissedAlerts.includes(dismissId)) {
    return null;
  }

  const handleDismiss = () => {
    if (!dismissId || dismissedAlerts.includes(dismissId)) {
      return;
    }
    const prev = new Set(dismissedAlerts);
    setDismissedAlerts([...prev, dismissId]);
  };

  return (
    <Alert
      type={pageAlert.type}
      data-test-id="page-error-alert"
      showIcon
      trailingItems={dismissId && <IconClose size="sm" onClick={handleDismiss} />}
    >
      <Fragment>{message}</Fragment>
    </Alert>
  );
}

export const usePageAlert = () => useContext(pageErrorContext);
