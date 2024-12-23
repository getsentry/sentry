import {useCallback} from 'react';

import useDrawer from 'sentry/components/globalDrawer';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import useOrganization from 'sentry/utils/useOrganization';

import type {ModuleName} from '../../types';

interface UseSamplesDrawerProps {
  Component: React.ReactNode;
  moduleName: ModuleName;
  onClose: () => void;
}

export function useSamplesDrawer({
  Component,
  moduleName,
  onClose,
}: UseSamplesDrawerProps) {
  const organization = useOrganization();
  const {openDrawer} = useDrawer();

  const openSamplesDrawer = useCallback(() => {
    trackAnalytics('performance_views.sample_spans.opened', {
      organization,
      source: moduleName,
    });

    openDrawer(() => Component, {
      ariaLabel: t('Samples'),
      onClose,
      transitionProps: {stiffness: 1000},
    });
  }, [openDrawer, onClose, Component, organization, moduleName]);

  return {openSamplesDrawer};
}
