import {getContextKeys} from 'sentry/components/events/contexts/utils';
import {t} from 'sentry/locale';
import type {KeyValueListData} from 'sentry/types/group';

enum RuntimeContextKeys {
  NAME = 'name',
  VERSION = 'version',
  BUILD = 'build',
  RAW_DESCRIPTION = 'raw_description',
}

export interface RuntimeContext {
  // Any custom keys users may set
  [key: string]: any;
  [RuntimeContextKeys.NAME]: string;
  [RuntimeContextKeys.VERSION]?: string;
  [RuntimeContextKeys.BUILD]?: string;
  [RuntimeContextKeys.RAW_DESCRIPTION]?: string;
}

export function getRuntimeContextData({
  data,
  meta,
}: {
  data: RuntimeContext;
  meta?: Record<keyof RuntimeContext, any>;
}): KeyValueListData {
  return getContextKeys({data, hiddenKeys: ['runtime']}).map(ctxKey => {
    switch (ctxKey) {
      case RuntimeContextKeys.NAME:
        return {
          key: ctxKey,
          subject: t('Name'),
          value: data.name,
        };
      case RuntimeContextKeys.BUILD:
        return {
          key: ctxKey,
          subject: t('Build'),
          value: data.build,
        };
      case RuntimeContextKeys.VERSION:
        return {
          key: ctxKey,
          subject: t('Version'),
          value: data.version,
        };
      case RuntimeContextKeys.RAW_DESCRIPTION:
        return {
          key: ctxKey,
          subject: t('Raw Description'),
          value: data.raw_description,
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
