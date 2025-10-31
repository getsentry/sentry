import {useCallback} from 'react';
import {parseAsString, useQueryState} from 'nuqs';

import useDrawer from 'sentry/components/globalDrawer';
import {DrawerUrlParams} from 'sentry/views/insights/agents/utils/urlParams';

export function useUrlTraceDrawer() {
  const {
    openDrawer: baseOpenDrawer,
    closeDrawer: baseCloseDrawer,
    isDrawerOpen,
    panelRef,
  } = useDrawer();

  const [selectedTrace, setSelectedTrace] = useQueryState(
    DrawerUrlParams.SELECTED_TRACE,
    parseAsString.withOptions({history: 'replace'})
  );

  const [_, setSelectedSpan] = useQueryState(
    DrawerUrlParams.SELECTED_SPAN,
    parseAsString.withOptions({history: 'replace'})
  );

  const removeQueryParams = useCallback(() => {
    setSelectedTrace(null);
  }, [setSelectedTrace]);

  const closeDrawer = useCallback(() => {
    removeQueryParams();
    return baseCloseDrawer();
  }, [baseCloseDrawer, removeQueryParams]);

  const openDrawer = useCallback(
    (
      renderer: Parameters<typeof baseOpenDrawer>[0],
      options?: Parameters<typeof baseOpenDrawer>[1] & {
        spanId?: string;
        traceSlug?: string;
      }
    ) => {
      const {
        traceSlug: optionsTraceSlug,
        spanId: optionsSpanId,
        onClose,
        ariaLabel,
        ...rest
      } = options || {};

      if (optionsTraceSlug) {
        setSelectedTrace(optionsTraceSlug);
      }
      if (optionsSpanId) {
        setSelectedSpan(optionsSpanId);
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
    [baseOpenDrawer, setSelectedTrace, setSelectedSpan, removeQueryParams]
  );

  return {
    openDrawer,
    closeDrawer,
    isDrawerOpen,
    panelRef,
    drawerUrlState: {trace: selectedTrace},
  };
}
