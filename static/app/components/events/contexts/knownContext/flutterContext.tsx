import {getContextKeys} from 'sentry/components/events/contexts/utils';
import {t} from 'sentry/locale';
import type {KeyValueListData} from 'sentry/types/group';

enum FlutterContextKeys {
  DEFAULT_ROUTE_NAME = 'default_route_name',
  HAS_RENDER_VIEW = 'has_render_view',
}

export interface FlutterContext {
  [key: string]: any;
  [FlutterContextKeys.DEFAULT_ROUTE_NAME]?: string;
  [FlutterContextKeys.HAS_RENDER_VIEW]?: string;
}

export function getFlutterContextData({
  data,
  meta,
}: {
  data: FlutterContext;
  meta?: Record<keyof FlutterContext, any>;
}): KeyValueListData {
  return getContextKeys({data}).map(ctxKey => {
    switch (ctxKey) {
      case FlutterContextKeys.DEFAULT_ROUTE_NAME:
        return {
          key: ctxKey,
          subject: t('Default Route Name'),
          value: data.default_route_name,
        };
      case FlutterContextKeys.HAS_RENDER_VIEW:
        return {
          key: ctxKey,
          subject: t('Has Render View'),
          value: data.has_render_view,
        };
      default:
        return {
          key: ctxKey,
          subject: ctxKey,
          value: data[ctxKey],
          meta: meta?.[ctxKey]?.[''],
        };
    }
  });
}
