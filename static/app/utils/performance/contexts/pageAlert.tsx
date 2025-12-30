import type React from 'react';
import {createContext, Fragment, useCallback, useContext, useState} from 'react';

import {Alert} from 'sentry/components/core/alert';
import {IconClose} from 'sentry/icons';
import type {AlertVariant} from 'sentry/utils/theme';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';

export enum DismissId {
  RESOURCE_SIZE_ALERT = 0,
}

type PageAlertOptions = {
  message: React.ReactNode | undefined;
  variant: AlertVariant;
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
  setPageMuted: PageAlertSetter;
  setPageSuccess: PageAlertSetter;
  setPageWarning: PageAlertSetter;
  pageAlert?: PageAlertOptions;
}>({
  pageAlert: undefined,
  setPageDanger: (_: React.ReactNode | undefined) => {},
  setPageInfo: (_: React.ReactNode | undefined) => {},
  setPageMuted: (_: React.ReactNode | undefined) => {},
  setPageSuccess: (_: React.ReactNode | undefined) => {},
  setPageWarning: (_: React.ReactNode | undefined) => {},
});

export function PageAlertProvider({children}: {children: React.ReactNode}) {
  const [pageAlert, setPageAlert] = useState<PageAlertOptions | undefined>();

  const setPageInfo: PageAlertSetter = useCallback((message, options) => {
    setPageAlert({message, variant: 'info', ...options});
  }, []);

  const setPageMuted: PageAlertSetter = useCallback((message, options) => {
    setPageAlert({message, variant: 'muted', ...options});
  }, []);

  const setPageSuccess: PageAlertSetter = useCallback((message, options) => {
    setPageAlert({message, variant: 'success', ...options});
  }, []);

  const setPageWarning: PageAlertSetter = useCallback((message, options) => {
    setPageAlert({message, variant: 'warning', ...options});
  }, []);

  const setPageDanger: PageAlertSetter = useCallback((message, options) => {
    setPageAlert({message, variant: 'danger', ...options});
  }, []);

  return (
    <PageErrorContext
      value={{
        pageAlert,
        setPageInfo,
        setPageMuted,
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
        variant={pageAlert.variant}
        data-test-id="page-error-alert"
        trailingItems={dismissId && <IconClose size="sm" onClick={handleDismiss} />}
      >
        <Fragment>{message}</Fragment>
      </Alert>
    </Alert.Container>
  );
}

export const usePageAlert = () => useContext(PageErrorContext);
