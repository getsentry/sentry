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

  const removeQueryParams = useCallback(async () => {
    await setSelectedTrace(null);
  }, [setSelectedTrace]);

  const closeDrawer = useCallback(async () => {
    await removeQueryParams();
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
        onClose: async () => {
          await removeQueryParams();
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
