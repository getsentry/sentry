import type {PropsWithChildren} from 'react';
import {useMemo} from 'react';
import {useTheme} from '@emotion/react';

import {
  OverlayContextProvider,
  type DrawerWidthStorage,
} from '@sentry/scraps/overlayContext';

import {ErrorBoundary} from 'sentry/components/errorBoundary';
import {t} from 'sentry/locale';
import {localStorageWrapper} from 'sentry/utils/localStorage';
import {useLocation} from 'sentry/utils/useLocation';
import {useMedia} from 'sentry/utils/useMedia';
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

function shouldCloseOnInteractOutside(element: Element) {
  if (document.getElementById('modal-portal')?.contains(element)) {
    return false;
  }
  const overlay = element.closest('[data-overlay]');
  return !overlay || overlay.hasAttribute('data-drawer-backdrop');
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
  const theme = useTheme();
  const location = useLocation();
  const {contentTop} = useTopOffset();
  // These overlays are fixed to the viewport.
  // oxlint-disable-next-line @sentry/scraps/prefer-container-responsive-props
  const isSmallScreen = useMedia(`(max-width: ${theme.breakpoints.sm})`);
  const value = useMemo(
    () => ({
      contentTop,
      headerHeight: `${PRIMARY_HEADER_HEIGHT}px`,
      isSmallScreen,
      drawer: {
        location,
        boundaryComponent: DrawerErrorBoundary,
        shouldCloseOnInteractOutside,
        widthStorage: drawerWidthStorage,
      },
    }),
    [contentTop, isSmallScreen, location]
  );

  return <OverlayContextProvider value={value}>{children}</OverlayContextProvider>;
}
