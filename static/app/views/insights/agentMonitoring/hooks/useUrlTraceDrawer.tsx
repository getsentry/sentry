import {useCallback} from 'react';
import omit from 'lodash/omit';

import useDrawer from 'sentry/components/globalDrawer';
import {decodeScalar} from 'sentry/utils/queryString';
import useLocationQuery from 'sentry/utils/url/useLocationQuery';
import {useTransitionedLocationUpdate} from 'sentry/views/insights/agentMonitoring/hooks/useUpdateLocation';
import {DrawerUrlParams} from 'sentry/views/insights/agentMonitoring/utils/urlParams';

export function useUrlTraceDrawer() {
  const {
    openDrawer: baseOpenDrawer,
    closeDrawer: baseCloseDrawer,
    isDrawerOpen,
    panelRef,
  } = useDrawer();

  const {trace} = useLocationQuery({
    fields: {
      [DrawerUrlParams.SELECTED_TRACE]: decodeScalar,
    },
  });

  const updateLocation = useTransitionedLocationUpdate();

  const removeQueryParams = useCallback(() => {
    updateLocation(prevLocation => ({
      pathname: prevLocation.pathname,
      query: omit(
        prevLocation.query,
        DrawerUrlParams.SELECTED_TRACE,
        DrawerUrlParams.SELECTED_SPAN
      ),
    }));
  }, [updateLocation]);

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
        updateLocation(prevLocation => ({
          pathname: prevLocation.pathname,
          query: {
            ...prevLocation.query,
            [DrawerUrlParams.SELECTED_TRACE]: optionsTraceSlug,
          },
        }));
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
    [baseOpenDrawer, updateLocation, removeQueryParams]
  );

  return {
    openDrawer,
    closeDrawer,
    isDrawerOpen,
    panelRef,
    drawerUrlState: {trace},
  };
}
