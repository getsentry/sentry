import {PlatformIcon} from 'platformicons';

import {getLaravelContextData} from 'sentry/components/events/contexts/platformContext/laravel';
import {getReactContextData} from 'sentry/components/events/contexts/platformContext/react';
import {getUnityContextData} from 'sentry/components/events/contexts/platformContext/unity';
import {getContextKeys} from 'sentry/components/events/contexts/utils';
import {t} from 'sentry/locale';
import type {KeyValueListData} from 'sentry/types/group';
import type {IconSize} from 'sentry/utils/theme';

export enum PlatformContextKeys {
  LARAVEL = 'laravel',
  REACT = 'react',
  UNITY = 'unity',
}

export const PLATFORM_CONTEXT_KEYS = new Set<string>(Object.values(PlatformContextKeys));

export function getPlatformContextTitle({platform}: {platform: string}): string {
  switch (platform) {
    case PlatformContextKeys.LARAVEL:
      return t('Laravel Context');
    case PlatformContextKeys.REACT:
      return 'React';
    case PlatformContextKeys.UNITY:
      return 'Unity';
    default:
      return platform;
  }
}

export function getPlatformContextIcon({
  platform,
  size = 'sm',
}: {
  platform: string;
  size?: IconSize;
}) {
  let platformIconName = '';
  switch (platform) {
    case PlatformContextKeys.LARAVEL:
      platformIconName = 'php-laravel';
      break;
    case PlatformContextKeys.REACT:
      platformIconName = 'javascript-react';
      break;
    case PlatformContextKeys.UNITY:
      platformIconName = 'unity';
      break;
    default:
      break;
  }

  if (platformIconName.length === 0) {
    return null;
  }

  return (
    <PlatformIcon
      size={size}
      platform={platformIconName}
      data-test-id={`${platform}-context-icon`}
    />
  );
}

export function getPlatformContextData({
  platform,
  data,
}: {
  data: any;
  platform: string;
}): KeyValueListData {
  switch (platform) {
    case PlatformContextKeys.LARAVEL:
      return getLaravelContextData({data});
    case PlatformContextKeys.REACT:
      return getReactContextData({data});
    case PlatformContextKeys.UNITY:
      return getUnityContextData({data});
    default:
      return getContextKeys({data}).map(ctxKey => ({
        key: ctxKey,
        subject: ctxKey,
        value: data[ctxKey],
      }));
  }
}
