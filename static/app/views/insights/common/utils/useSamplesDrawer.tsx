import {useCallback, useEffect} from 'react';
import type {Location} from 'history';

import {Stack} from '@sentry/scraps/layout';

import useDrawer from 'sentry/components/globalDrawer';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import type {ModuleName} from 'sentry/views/insights/types';

interface UseSamplesDrawerProps {
  Component: React.ReactNode;
  moduleName: ModuleName;
  requiredParams: [string, ...string[]];
  onClose?: () => void;
}

export function useSamplesDrawer({
  Component,
  moduleName,
  requiredParams,
  onClose = undefined,
}: UseSamplesDrawerProps): void {
  const organization = useOrganization();
  const {openDrawer, isDrawerOpen} = useDrawer();
  const navigate = useNavigate();
  const location = useLocation();

  const onCloseAction = useCallback(() => {
    if (onClose) {
      onClose();
    } else {
      navigate({
        query: {
          ...location.query,
          transaction: undefined,
          transactionMethod: undefined,
          spanGroup: undefined,
          spanOp: undefined,
          query: undefined,
          responseCodeClass: undefined,
          panel: undefined,
          statusClass: undefined,
          spanSearchQuery: undefined,
          traceStatus: undefined,
          retryCount: undefined,
        },
      });
    }
  }, [navigate, onClose, location.query]);

  const shouldCloseOnLocationChange = useCallback(
    (newLocation: Location) => {
      if (!requiredParams.every(paramName => Boolean(newLocation.query[paramName]))) {
        return true;
      }

      if (newLocation.pathname.includes('/trace/')) {
        return true;
      }

      return false;
    },
    [requiredParams]
  );

  const openSamplesDrawer = useCallback(() => {
    if (isDrawerOpen) {
      return;
    }

    trackAnalytics('performance_views.sample_spans.opened', {
      organization,
      source: moduleName,
    });

    openDrawer(() => <Stack height="100%">{Component}</Stack>, {
      ariaLabel: t('Samples'),
      onClose: onCloseAction,
      shouldCloseOnLocationChange,
      shouldCloseOnInteractOutside: () => false,
    });
  }, [
    openDrawer,
    isDrawerOpen,
    onCloseAction,
    shouldCloseOnLocationChange,
    Component,
    organization,
    moduleName,
  ]);

  const shouldDrawerOpen = requiredParams.every(paramName =>
    Boolean(location.query[paramName])
  );
  useEffect(() => {
    if (shouldDrawerOpen) {
      openSamplesDrawer();
    }
  }, [shouldDrawerOpen, openSamplesDrawer]);
}
