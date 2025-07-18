import {useCallback} from 'react';

import useDrawer from 'sentry/components/globalDrawer';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocationSyncedState} from 'sentry/views/insights/agentMonitoring/hooks/useLocationSyncedState';
import {DrawerUrlParams} from 'sentry/views/insights/agentMonitoring/utils/urlParams';

export function useUrlTraceDrawer() {
  const {
    openDrawer: baseOpenDrawer,
    closeDrawer: baseCloseDrawer,
    isDrawerOpen,
    panelRef,
  } = useDrawer();

  const [selectedTrace, setSelectedTrace, removeTraceParam] = useLocationSyncedState(
    DrawerUrlParams.SELECTED_TRACE,
    decodeScalar
  );

  const removeQueryParams = useCallback(() => {
    removeTraceParam();
  }, [removeTraceParam]);

  const closeDrawer = useCallback(() => {
    removeQueryParams();
    return baseCloseDrawer();
  }, [baseCloseDrawer, removeQueryParams]);

  const openDrawer = useCallback(
    (
      renderer: Parameters<typeof baseOpenDrawer>[0],
      options?: Parameters<typeof baseOpenDrawer>[1] & {traceSlug?: string}
    ) => {
      const {traceSlug: optionsTraceSlug, onClose, ariaLabel, ...rest} = options || {};

      if (optionsTraceSlug) {
        setSelectedTrace(optionsTraceSlug);
      }

      return baseOpenDrawer(renderer, {
        ...rest,
        ariaLabel: ariaLabel || 'Trace Drawer',
        shouldCloseOnLocationChange: nextLocation => {
          return !nextLocation.query[DrawerUrlParams.SELECTED_TRACE];
        },
        onClose: () => {
          removeQueryParams();
          onClose?.();
        },
      });
    },
    [baseOpenDrawer, setSelectedTrace, removeQueryParams]
  );

  return {
    openDrawer,
    closeDrawer,
    isDrawerOpen,
    panelRef,
    drawerUrlState: {trace: selectedTrace},
  };
}
