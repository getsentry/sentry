import type {SVGIconProps} from '@sentry/icons/svgIcon';
import {PlatformIcon} from 'platformicons';

import {getContextKeys} from 'sentry/components/events/contexts/dataUtils';
import {t} from 'sentry/locale';
import type {KeyValueListData} from 'sentry/types/group';

import {getLaravelContextData} from './laravel';
import {getReactContextData} from './react';
import {getSpringContextData} from './spring';
import {getUnityContextData} from './unity';

enum PlatformContextKeys {
  LARAVEL = 'laravel',
  REACT = 'react',
  UNITY = 'unity',
  SPRING = 'spring',
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
    case PlatformContextKeys.SPRING:
      return 'Spring';
    default:
      return platform;
  }
}

export function getPlatformContextIcon({
  platform,
  size = 'sm',
}: {
  platform: string;
  size?: SVGIconProps['size'];
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
    case PlatformContextKeys.SPRING:
      platformIconName = 'java-spring';
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
    case PlatformContextKeys.SPRING:
      return getSpringContextData({data});
    default:
      return getContextKeys({data}).map(ctxKey => ({
        key: ctxKey,
        subject: ctxKey,
        value: data[ctxKey],
      }));
  }
}
