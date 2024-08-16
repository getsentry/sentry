import {PlatformIcon} from 'platformicons';

import {getKnownData, getUnknownData} from 'sentry/components/events/contexts/utils';
import type {IconSize} from 'sentry/utils/theme';

/**
 * Mapping of platform to known context keys for platform-specific context.
 */
const KNOWN_PLATFORM_CONTEXT_KEYS: Record<string, string[]> = {
  laravel: [],
};

export const KNOWN_PLATFORM_CONTEXTS = new Set(Object.keys(KNOWN_PLATFORM_CONTEXT_KEYS));

interface PlatformContextProps {
  data: Record<string, any>;
  platform: string;
  meta?: Record<string, any>;
}

enum PlatformContextKeys {}

export function getKnownPlatformContextData({
  platform,
  data,
  meta,
}: PlatformContextProps) {
  return getKnownData<PlatformContextProps['data'], PlatformContextKeys>({
    data,
    meta,
    knownDataTypes: KNOWN_PLATFORM_CONTEXT_KEYS[platform] ?? [],
    onGetKnownDataDetails: () => {
      switch (platform) {
        default:
          return undefined;
      }
    },
  });
}

export function getUnknownPlatformContextData({
  platform,
  data,
  meta,
}: PlatformContextProps) {
  return getUnknownData({
    allData: data,
    knownKeys: KNOWN_PLATFORM_CONTEXT_KEYS[platform] ?? [],
    meta,
  });
}

export function getPlatformContextIcon({
  platform,
  size = 'sm',
}: Pick<PlatformContextProps, 'platform'> & {
  size?: IconSize;
}) {
  let platformIconName = '';
  switch (platform) {
    case 'laravel':
      platformIconName = 'php-laravel';
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
