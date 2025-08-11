import {getContextKeys} from 'sentry/components/events/contexts/utils';
import {t} from 'sentry/locale';
import type {KeyValueListData} from 'sentry/types/group';
import {defined} from 'sentry/utils';

// https://develop.sentry.dev/sdk/data-model/event-payloads/contexts/#os-context
enum OperatingSystemContextKeys {
  NAME = 'name',
  VERSION = 'version',
  BUILD = 'build',
  KERNEL_VERSION = 'kernel_version',
  ROOTED = 'rooted',
  THEME = 'theme',
  RAW_DESCRIPTION = 'raw_description',
  DISTRIBUTION = 'distribution',
}

export interface OperatingSystemContext {
  // Any custom keys users may set
  [key: string]: any;
  [OperatingSystemContextKeys.NAME]?: string;
  [OperatingSystemContextKeys.VERSION]?: string;
  [OperatingSystemContextKeys.BUILD]?: string;
  [OperatingSystemContextKeys.KERNEL_VERSION]?: string;
  [OperatingSystemContextKeys.ROOTED]?: boolean;
  [OperatingSystemContextKeys.THEME]?: string;
  [OperatingSystemContextKeys.RAW_DESCRIPTION]?: string;
  [OperatingSystemContextKeys.DISTRIBUTION]?: {
    name?: string;
    pretty_name?: string;
    version?: string;
  };
}

export function getOperatingSystemContextData({
  data,
  meta,
}: {
  data: OperatingSystemContext;
  meta?: Record<keyof OperatingSystemContext, any>;
}): KeyValueListData {
  return getContextKeys({data, hiddenKeys: ['os']}).map(ctxKey => {
    switch (ctxKey) {
      case OperatingSystemContextKeys.NAME:
        return {
          key: ctxKey,
          subject: t('Name'),
          value: data.name,
        };
      case OperatingSystemContextKeys.VERSION:
        return {
          key: ctxKey,
          subject: t('Version'),
          value: data.version,
        };
      case OperatingSystemContextKeys.BUILD:
        return {
          key: ctxKey,
          subject: t('Build'),
          value: data.build,
        };
      case OperatingSystemContextKeys.KERNEL_VERSION:
        return {
          key: ctxKey,
          subject: t('Kernel Version'),
          value: data.kernel_version,
        };
      case OperatingSystemContextKeys.ROOTED:
        return {
          key: ctxKey,
          subject: t('Rooted'),
          value: defined(data.rooted) ? (data.rooted ? t('yes') : t('no')) : null,
        };
      case OperatingSystemContextKeys.THEME:
        return {
          key: ctxKey,
          subject: t('Theme'),
          value: data.theme,
        };
      case OperatingSystemContextKeys.RAW_DESCRIPTION:
        return {
          key: ctxKey,
          subject: t('Raw Description'),
          value: data.raw_description,
        };
      case OperatingSystemContextKeys.DISTRIBUTION:
        return {
          key: ctxKey,
          subject: t('Distro'),
          value: data.distribution?.pretty_name
            ? data.distribution?.pretty_name
            : `${data.distribution?.name}${data.distribution?.version ? `(${data.distribution.version})` : ''}`,
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
