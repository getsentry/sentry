import type {PropsWithChildren} from 'react';

import {GlobalDrawer as BaseGlobalDrawer} from '@sentry/scraps/drawer';

import {ErrorBoundary} from 'sentry/components/errorBoundary';
import {t} from 'sentry/locale';
import {useLocation} from 'sentry/utils/useLocation';
import {PRIMARY_HEADER_HEIGHT} from 'sentry/views/navigation/constants';

import {DrawerPanel} from './components';

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

export function GlobalDrawer({children}: PropsWithChildren) {
  const location = useLocation();
  return (
    <BaseGlobalDrawer
      location={location}
      headerHeight={`${PRIMARY_HEADER_HEIGHT}px`}
      panelComponent={DrawerPanel}
      boundaryComponent={DrawerErrorBoundary}
      shouldCloseOnInteractOutside={shouldCloseOnInteractOutside}
    >
      {children}
    </BaseGlobalDrawer>
  );
}
