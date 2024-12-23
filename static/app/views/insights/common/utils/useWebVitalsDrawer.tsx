import {useCallback} from 'react';

import useDrawer from 'sentry/components/globalDrawer';
import {t} from 'sentry/locale';

import type {WebVitals} from '../../browser/webVitals/types';

interface UseWebVitalsDrawerProps {
  Component: React.ReactNode;
  onClose: () => void;
  webVital: WebVitals | null;
}

export function useWebVitalsDrawer({
  Component,
  webVital,
  onClose,
}: UseWebVitalsDrawerProps) {
  const {openDrawer} = useDrawer();

  const openVitalsDrawer = useCallback(() => {
    if (!webVital) {
      return;
    }

    openDrawer(() => Component, {
      ariaLabel: t('%s Details', webVital),
      onClose,
      transitionProps: {stiffness: 1000},
    });
  }, [openDrawer, onClose, Component, webVital]);

  return {openVitalsDrawer};
}
