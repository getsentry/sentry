import {getContextKeys} from 'sentry/components/events/contexts/utils';
import {t} from 'sentry/locale';
import type {KeyValueListData} from 'sentry/types/group';

// https://develop.sentry.dev/sdk/data-model/event-payloads/contexts/#missing-instrumentation-context
const enum MissingInstrumentationContextKeys {
  PACKAGE = 'package',
  FROM_COMMONJS = 'javascript.is_cjs',
}

export interface MissingInstrumentationContext {
  // Any custom keys users may set
  [key: string]: any;
  [MissingInstrumentationContextKeys.PACKAGE]?: string;
  [MissingInstrumentationContextKeys.FROM_COMMONJS]?: boolean;
}

export function getMissingInstrumentationContextData({
  data = {},
  meta,
}: {
  data: MissingInstrumentationContext;
  meta?: Record<keyof MissingInstrumentationContext, any>;
}): KeyValueListData {
  return getContextKeys({data}).map(ctxKey => {
    switch (ctxKey) {
      case MissingInstrumentationContextKeys.PACKAGE:
        return {
          key: ctxKey,
          subject: t('Package w/o Instrumentation'),
          value: data[MissingInstrumentationContextKeys.PACKAGE],
        };
      case MissingInstrumentationContextKeys.FROM_COMMONJS:
        return {
          key: ctxKey,
          subject: t('From CommonJS Module?'),
          value: data[MissingInstrumentationContextKeys.FROM_COMMONJS],
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
