import {useMemo} from 'react';
import omit from 'lodash/omit';

import useDrawer from 'sentry/components/globalDrawer';
import {t} from 'sentry/locale';
import {decodeScalar} from 'sentry/utils/queryString';
import useLocationQuery from 'sentry/utils/url/useLocationQuery';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';

enum TraceDrawerFields {
  DRAWER = 'drawer',
  TRACE_SLUG = 'trace',
}

const TRACE_DRAWER_FIELD_MAP = {
  [TraceDrawerFields.DRAWER]: decodeScalar,
  [TraceDrawerFields.TRACE_SLUG]: decodeScalar,
};

const TRACE_DRAWER_FIELD_KEYS = Object.keys(TRACE_DRAWER_FIELD_MAP);

export function useUrlTraceDrawer() {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    openDrawer: baseOpenDrawer,
    closeDrawer: baseCloseDrawer,
    isDrawerOpen,
    panelRef,
  } = useDrawer();

  const {drawer, trace} = useLocationQuery({
    fields: TRACE_DRAWER_FIELD_MAP,
  });

  const openDrawer = useMemo(() => {
    return (
      renderer: Parameters<typeof baseOpenDrawer>[0],
      options?: Parameters<typeof baseOpenDrawer>[1] & {traceSlug?: string}
    ) => {
      const {traceSlug, onClose, ariaLabel, ...rest} = options || {};

      if (traceSlug) {
        navigate(
          {
            pathname: location.pathname,
            query: {
              ...location.query,
              [TraceDrawerFields.DRAWER]: 'open',
              [TraceDrawerFields.TRACE_SLUG]: traceSlug,
            },
          },
          {replace: true}
        );
      }

      return baseOpenDrawer(renderer, {
        ...rest,
        ariaLabel: ariaLabel || t('Trace Drawer'),
        shouldCloseOnLocationChange: nextLocation => {
          // Don't close if we're just updating the drawer state in URL
          return nextLocation.query[TraceDrawerFields.DRAWER] !== 'open';
        },
        onClose: () => {
          navigate(
            {
              pathname: location.pathname,
              query: omit(location.query, TRACE_DRAWER_FIELD_KEYS),
            },
            {replace: true}
          );

          onClose?.();
        },
      });
    };
  }, [baseOpenDrawer, navigate, location]);

  const closeDrawer = useMemo(() => {
    return () => {
      navigate(
        {
          pathname: location.pathname,
          query: omit(location.query, TRACE_DRAWER_FIELD_KEYS),
        },
        {replace: true}
      );

      return baseCloseDrawer();
    };
  }, [baseCloseDrawer, navigate, location]);

  const drawerUrlState = {
    drawer,
    trace,
  };

  return {
    openDrawer,
    closeDrawer,
    isDrawerOpen,
    panelRef,
    drawerUrlState,
  };
}
