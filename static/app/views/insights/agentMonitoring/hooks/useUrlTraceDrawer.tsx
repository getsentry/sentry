import {useCallback} from 'react';
import omit from 'lodash/omit';

import useDrawer from 'sentry/components/globalDrawer';
import {decodeScalar} from 'sentry/utils/queryString';
import useLocationQuery from 'sentry/utils/url/useLocationQuery';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';

const DRAWER_TRACE_SLUG = 'trace';

export function useUrlTraceDrawer() {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    openDrawer: baseOpenDrawer,
    closeDrawer: baseCloseDrawer,
    isDrawerOpen,
    panelRef,
  } = useDrawer();

  const {trace} = useLocationQuery({
    fields: {
      [DRAWER_TRACE_SLUG]: decodeScalar,
    },
  });

  const removeQueryParams = useCallback(() => {
    navigate(
      {
        pathname: location.pathname,
        query: omit(location.query, DRAWER_TRACE_SLUG),
      },
      {replace: true}
    );
  }, [navigate, location.pathname, location.query]);

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
        navigate(
          {
            pathname: location.pathname,
            query: {
              ...location.query,
              [DRAWER_TRACE_SLUG]: optionsTraceSlug,
            },
          },
          {replace: true}
        );
      }

      return baseOpenDrawer(renderer, {
        ...rest,
        ariaLabel: ariaLabel || 'Trace Drawer',
        shouldCloseOnLocationChange: nextLocation => {
          return !nextLocation.query[DRAWER_TRACE_SLUG];
        },
        onClose: () => {
          removeQueryParams();
          onClose?.();
        },
      });
    },
    [baseOpenDrawer, removeQueryParams, navigate, location.pathname, location.query]
  );

  return {
    openDrawer,
    closeDrawer,
    isDrawerOpen,
    panelRef,
    drawerUrlState: {trace},
  };
}
