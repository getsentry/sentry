import {useCallback, useEffect} from 'react';
import styled from '@emotion/styled';
import type {Location} from 'history';

import useDrawer from 'sentry/components/globalDrawer';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';

import type {ModuleName} from '../../types';

interface UseSamplesDrawerProps {
  Component: React.ReactNode;
  moduleName: ModuleName;
  requiredParams: [string, ...string[]];
}

export function useSamplesDrawer({
  Component,
  moduleName,
  requiredParams,
}: UseSamplesDrawerProps): void {
  const organization = useOrganization();
  const {openDrawer, closeDrawer, isDrawerOpen} = useDrawer();
  const navigate = useNavigate();
  const location = useLocation();

  const onClose = useCallback(() => {
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
  }, [navigate, location.query]);

  const shouldCloseOnLocationChange = useCallback(
    (newLocation: Location) => {
      return !requiredParams.some(paramName => Boolean(newLocation.query[paramName]));
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

    openDrawer(() => <FullHeightWrapper>{Component}</FullHeightWrapper>, {
      ariaLabel: t('Samples'),
      onClose,
      transitionProps: {stiffness: 1000},
      shouldCloseOnLocationChange,
      shouldCloseOnInteractOutside: () => false,
    });
  }, [
    openDrawer,
    isDrawerOpen,
    onClose,
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
    } else {
      closeDrawer();
    }
  }, [shouldDrawerOpen, openSamplesDrawer, closeDrawer]);
}

const FullHeightWrapper = styled('div')`
  height: 100%;
  display: flex;
  flex-direction: column;
`;
