import type {PropsWithChildren} from 'react';
import {useMemo} from 'react';

import type {ModalBoundaryProps} from '@sentry/scraps/modal';
import {
  OverlayContextProvider,
  type DrawerWidthStorage,
} from '@sentry/scraps/overlayContext';

import {ErrorBoundary} from 'sentry/components/errorBoundary';
import {ROOT_ELEMENT} from 'sentry/constants';
import {t} from 'sentry/locale';
import {localStorageWrapper} from 'sentry/utils/localStorage';
import {useLocation} from 'sentry/utils/useLocation';
import {PRIMARY_HEADER_HEIGHT} from 'sentry/views/navigation/constants';
import {useTopOffset} from 'sentry/views/navigation/useTopOffset';

function DrawerErrorBoundary({children}: PropsWithChildren) {
  return (
    <ErrorBoundary
      mini
      allowDismiss
      message={t('There was a problem rendering the drawer.')}
    >
      {children}
    </ErrorBoundary>
  );
}

function getAppElement() {
  return document.getElementById(ROOT_ELEMENT);
}

function ModalErrorBoundary({children, resetKey, onDismiss, header}: ModalBoundaryProps) {
  return (
    <ErrorBoundary
      mini
      allowDismiss
      resetKey={resetKey}
      onDismiss={onDismiss}
      header={header}
      message={t('There was a problem rendering the dialog.')}
    >
      {children}
    </ErrorBoundary>
  );
}

const drawerWidthStorage: DrawerWidthStorage = {
  get(key) {
    const value = localStorageWrapper.getItem(key);
    try {
      const width: unknown = value === null ? undefined : JSON.parse(value);
      return typeof width === 'number' ? width : undefined;
    } catch {
      return;
    }
  },
  set(key, widthPercent) {
    localStorageWrapper.setItem(key, JSON.stringify(widthPercent));
    window.dispatchEvent(
      new CustomEvent('synced-local-storage', {
        detail: {key, value: widthPercent},
      })
    );
  },
  subscribe(key, listener) {
    const handleSyncedStorage = (event: Event) => {
      if (event instanceof CustomEvent && event.detail.key === key) {
        // The existing synced-storage hook writes in a microtask.
        queueMicrotask(listener);
      }
    };
    window.addEventListener('synced-local-storage', handleSyncedStorage);
    return () => {
      window.removeEventListener('synced-local-storage', handleSyncedStorage);
    };
  },
};

export function SentryOverlayProvider({children}: PropsWithChildren) {
  const location = useLocation();
  const {contentTop} = useTopOffset();
  const value = useMemo(
    () => ({
      contentTop,
      headerHeight: `${PRIMARY_HEADER_HEIGHT}px`,
      location,
      modal: {getAppElement, boundaryComponent: ModalErrorBoundary},
      drawer: {
        boundaryComponent: DrawerErrorBoundary,
        widthStorage: drawerWidthStorage,
      },
    }),
    [contentTop, location]
  );

  return <OverlayContextProvider value={value}>{children}</OverlayContextProvider>;
}
