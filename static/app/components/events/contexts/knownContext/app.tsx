import {
  getContextKeys,
  getRelativeTimeFromEventDateCreated,
} from 'sentry/components/events/contexts/utils';
import {t} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import type {KeyValueListData} from 'sentry/types/group';
import {formatBytesBase2} from 'sentry/utils/bytes/formatBytesBase2';

enum AppContextKeys {
  ID = 'app_id',
  START_TIME = 'app_start_time',
  DEVICE_HASH = 'device_app_hash',
  TYPE = 'build_type',
  IDENTIFIER = 'app_identifier',
  NAME = 'app_name',
  VERSION = 'app_version',
  BUILD = 'app_build',
  IN_FOREGROUND = 'in_foreground',
  MEMORY = 'app_memory',
  VIEW_NAMES = 'view_names',
}

export interface AppContext {
  // Any custom keys users may set
  [key: string]: any;
  [AppContextKeys.BUILD]?: string;
  [AppContextKeys.ID]?: string;
  [AppContextKeys.IDENTIFIER]?: string;
  [AppContextKeys.NAME]?: string;
  [AppContextKeys.START_TIME]?: string;
  [AppContextKeys.VERSION]?: string;
  [AppContextKeys.TYPE]?: string;
  [AppContextKeys.DEVICE_HASH]?: string;
  [AppContextKeys.IN_FOREGROUND]?: boolean;
  [AppContextKeys.MEMORY]?: number;
  [AppContextKeys.VIEW_NAMES]?: string[];
}

// https://github.com/getsentry/relay/blob/24.10.0/relay-event-schema/src/protocol/contexts/app.rs#L37
function formatMemory(memoryInBytes: number) {
  if (!Number.isInteger(memoryInBytes) || memoryInBytes <= 0) {
    return null;
  }
  return formatBytesBase2(memoryInBytes);
}

export function getAppContextData({
  data,
  event,
  meta,
}: {
  data: AppContext;
  event: Event;
  meta?: Record<keyof AppContext, any>;
}): KeyValueListData {
  return getContextKeys({data}).map(ctxKey => {
    switch (ctxKey) {
      case AppContextKeys.ID:
        return {
          key: ctxKey,
          subject: t('ID'),
          value: data.app_id,
        };
      case AppContextKeys.START_TIME:
        return {
          key: ctxKey,
          subject: t('Start Time'),
          value: getRelativeTimeFromEventDateCreated(
            event.dateCreated ? event.dateCreated : event.dateReceived,
            data.app_start_time
          ),
        };
      case AppContextKeys.DEVICE_HASH:
        return {
          key: ctxKey,
          subject: t('Device'),
          value: data.device_app_hash,
        };
      case AppContextKeys.TYPE:
        return {
          key: ctxKey,
          subject: t('Build Type'),
          value: data.build_type,
        };
      case AppContextKeys.IDENTIFIER:
        return {
          key: ctxKey,
          subject: t('Build ID'),
          value: data.app_identifier,
        };
      case AppContextKeys.NAME:
        return {
          key: ctxKey,
          subject: t('Build Name'),
          value: data.app_name,
        };
      case AppContextKeys.VERSION:
        return {
          key: ctxKey,
          subject: t('Version'),
          value: data.app_version,
        };
      case AppContextKeys.BUILD:
        return {
          key: ctxKey,
          subject: t('App Build'),
          value: data.app_build,
        };
      case AppContextKeys.IN_FOREGROUND:
        return {
          key: ctxKey,
          subject: t('In Foreground'),
          value: data.in_foreground,
        };
      case AppContextKeys.MEMORY:
        return {
          key: ctxKey,
          subject: t('Memory Usage'),
          value: data.app_memory ? formatMemory(data.app_memory) : undefined,
        };
      case AppContextKeys.VIEW_NAMES:
        return {
          key: ctxKey,
          subject: t('View Names'),
          value: data.view_names,
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
