import {getContextKeys} from 'sentry/components/events/contexts/utils';
import {t} from 'sentry/locale';
import type {KeyValueListData} from 'sentry/types/group';

enum DartContextKeys {
  COMPILE_MODE = 'compile_mode',
  EXECUTABLE = 'executable',
  RESOLVED_EXECUTABLE = 'resolved_executable',
  SCRIPT = 'script',
}

export interface DartContext {
  [key: string]: any;
  [DartContextKeys.COMPILE_MODE]?: string;
  [DartContextKeys.EXECUTABLE]?: string;
  [DartContextKeys.RESOLVED_EXECUTABLE]?: string;
  [DartContextKeys.SCRIPT]?: string;
}

export function getDartContextData({
  data,
  meta,
}: {
  data: DartContext;
  meta?: Record<keyof DartContext, any>;
}): KeyValueListData {
  return getContextKeys({data}).map(ctxKey => {
    switch (ctxKey) {
      case DartContextKeys.COMPILE_MODE:
        return {
          key: ctxKey,
          subject: t('Compile Mode'),
          value: data.compile_mode,
        };
      case DartContextKeys.EXECUTABLE:
        return {
          key: ctxKey,
          subject: t('Executable'),
          value: data.executable,
        };
      case DartContextKeys.RESOLVED_EXECUTABLE:
        return {
          key: ctxKey,
          subject: t('Resolved Executable'),
          value: data.resolved_executable,
        };
      case DartContextKeys.SCRIPT:
        return {
          key: ctxKey,
          subject: t('Script'),
          value: data.script,
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
