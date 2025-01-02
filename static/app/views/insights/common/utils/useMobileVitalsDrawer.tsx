import {useCallback} from 'react';

import useDrawer from 'sentry/components/globalDrawer';
import {t} from 'sentry/locale';

import type {VitalItem} from '../../mobile/screens/utils';

interface UseMobileVitalsDrawerProps {
  Component: React.ReactNode;
  onClose: () => void;
  vital?: VitalItem;
}

export function useMobileVitalsDrawer({
  Component,
  vital,
  onClose,
}: UseMobileVitalsDrawerProps) {
  const {openDrawer} = useDrawer();

  const openVitalsDrawer = useCallback(() => {
    if (!vital) {
      return;
    }

    openDrawer(() => Component, {
      ariaLabel: t('%s Details', vital.title),
      onClose,
      transitionProps: {stiffness: 1000},
    });
  }, [openDrawer, onClose, Component, vital]);

  return {openVitalsDrawer};
}
