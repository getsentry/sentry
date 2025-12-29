import type React from 'react';
import {createContext, Fragment, useCallback, useContext, useState} from 'react';
import type {Theme} from '@emotion/react';

import {Alert} from 'sentry/components/core/alert';
import {IconClose} from 'sentry/icons';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';

type PageAlertType = keyof Theme['alert'];

export enum DismissId {
  RESOURCE_SIZE_ALERT = 0,
}

type PageAlertOptions = {
  message: React.ReactNode | undefined;
  type: PageAlertType;
  dismissId?: DismissId;
};

const localStorageKey = 'sentry:page-alert';

type PageAlertSetter = (
  message: React.ReactNode | undefined,
  options?: Pick<PageAlertOptions, 'dismissId'>
) => void;

const PageErrorContext = createContext<{
  setPageDanger: PageAlertSetter;
  setPageInfo: PageAlertSetter;
  setPageSubtle: PageAlertSetter;
  setPageSuccess: PageAlertSetter;
  setPageWarning: PageAlertSetter;
  pageAlert?: PageAlertOptions;
}>({
  pageAlert: undefined,
  setPageDanger: (_: React.ReactNode | undefined) => {},
  setPageInfo: (_: React.ReactNode | undefined) => {},
  setPageSubtle: (_: React.ReactNode | undefined) => {},
  setPageSuccess: (_: React.ReactNode | undefined) => {},
  setPageWarning: (_: React.ReactNode | undefined) => {},
});

export function PageAlertProvider({children}: {children: React.ReactNode}) {
  const [pageAlert, setPageAlert] = useState<PageAlertOptions | undefined>();

  const setPageInfo: PageAlertSetter = useCallback((message, options) => {
    setPageAlert({message, type: 'info', ...options});
  }, []);

  const setPageSubtle: PageAlertSetter = useCallback((message, options) => {
    setPageAlert({message, type: 'subtle', ...options});
  }, []);

  const setPageSuccess: PageAlertSetter = useCallback((message, options) => {
    setPageAlert({message, type: 'success', ...options});
  }, []);

  const setPageWarning: PageAlertSetter = useCallback((message, options) => {
    setPageAlert({message, type: 'warning', ...options});
  }, []);

  const setPageDanger: PageAlertSetter = useCallback((message, options) => {
    setPageAlert({message, type: 'danger', ...options});
  }, []);

  return (
    <PageErrorContext
      value={{
        pageAlert,
        setPageInfo,
        setPageSubtle,
        setPageSuccess,
        setPageWarning,
        setPageDanger,
      }}
    >
      {children}
    </PageErrorContext>
  );
}

export function PageAlert() {
  const {pageAlert} = useContext(PageErrorContext);
  const [dismissedAlerts, setDismissedAlerts] = useLocalStorageState<number[]>(
    localStorageKey,
    []
  );

  if (!pageAlert?.message) {
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
    <Alert.Container>
      <Alert
        type={pageAlert.type}
        data-test-id="page-error-alert"
        trailingItems={dismissId && <IconClose size="sm" onClick={handleDismiss} />}
      >
        <Fragment>{message}</Fragment>
      </Alert>
    </Alert.Container>
  );
}

export const usePageAlert = () => useContext(PageErrorContext);
