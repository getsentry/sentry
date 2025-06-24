import {useCallback} from 'react';
import omit from 'lodash/omit';

import useDrawer from 'sentry/components/globalDrawer';
import {decodeScalar} from 'sentry/utils/queryString';
import useLocationQuery from 'sentry/utils/url/useLocationQuery';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';

enum TraceDrawerFields {
  DRAWER_OPEN = 'drawerOpen',
  TRACE_SLUG = 'trace',
}

const AI_TRACE_DRAWER_FIELD_MAP = {
  [TraceDrawerFields.DRAWER_OPEN]: decodeScalar,
  [TraceDrawerFields.TRACE_SLUG]: decodeScalar,
};

const AI_TRACE_DRAWER_FIELD_KEYS = Object.keys(AI_TRACE_DRAWER_FIELD_MAP);

export function useUrlTraceDrawer() {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    openDrawer: baseOpenDrawer,
    closeDrawer: baseCloseDrawer,
    isDrawerOpen,
    panelRef,
  } = useDrawer();

  const {drawerOpen, trace} = useLocationQuery({
    fields: AI_TRACE_DRAWER_FIELD_MAP,
  });

  const removeQueryParams = useCallback(() => {
    navigate(
      {
        pathname: location.pathname,
        query: omit(location.query, AI_TRACE_DRAWER_FIELD_KEYS),
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
              [TraceDrawerFields.DRAWER_OPEN]: 'open',
              [TraceDrawerFields.TRACE_SLUG]: optionsTraceSlug,
            },
          },
          {replace: true}
        );
      }

      return baseOpenDrawer(renderer, {
        ...rest,
        ariaLabel: ariaLabel || 'Trace Drawer',
        shouldCloseOnLocationChange: nextLocation => {
          return nextLocation.query[TraceDrawerFields.DRAWER_OPEN] !== 'open';
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
    drawerUrlState: {drawerOpen, trace},
  };
}
