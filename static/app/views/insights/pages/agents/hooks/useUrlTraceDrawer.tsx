import {useCallback} from 'react';

import useDrawer from 'sentry/components/globalDrawer';
import {
  DrawerUrlParams,
  useTraceDrawerQueryState,
} from 'sentry/views/insights/pages/agents/utils/urlParams';

export function useUrlTraceDrawer() {
  const {
    openDrawer: baseOpenDrawer,
    closeDrawer: baseCloseDrawer,
    isDrawerOpen,
    panelRef,
  } = useDrawer();

  const [traceDrawerQueryState, setTraceDrawerQueryState] = useTraceDrawerQueryState();

  const removeQueryParams = useCallback(() => {
    setTraceDrawerQueryState(null);
  }, [setTraceDrawerQueryState]);

  const closeDrawer = useCallback(() => {
    removeQueryParams();
    return baseCloseDrawer();
  }, [baseCloseDrawer, removeQueryParams]);

  const openDrawer = useCallback(
    (
      renderer: Parameters<typeof baseOpenDrawer>[0],
      options?: Parameters<typeof baseOpenDrawer>[1] & {
        spanId?: string;
        timestamp?: number;
        traceSlug?: string;
      }
    ) => {
      const {
        traceSlug: optionsTraceSlug,
        spanId: optionsSpanId,
        timestamp: optionsTimestamp,
        onClose,
        ariaLabel,
        ...rest
      } = options || {};

      setTraceDrawerQueryState({
        traceId: optionsTraceSlug,
        spanId: optionsSpanId,
        timestamp: optionsTimestamp,
      });

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
    [baseOpenDrawer, setTraceDrawerQueryState, removeQueryParams]
  );

  return {
    openDrawer,
    closeDrawer,
    isDrawerOpen,
    panelRef,
    drawerUrlState: traceDrawerQueryState,
  };
}
