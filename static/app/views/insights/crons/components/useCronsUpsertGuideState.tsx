import {useCallback} from 'react';
import {parseAsStringEnum, useQueryStates} from 'nuqs';

import type {PlatformKey} from 'sentry/types/project';

import {
  platformGuides,
  type CronsPlatform,
  type CronsPlatformGuide,
  type GuideKey,
  type SupportedPlatform,
} from './upsertPlatformGuides';

/**
 * Parsers for platform and guide query parameters.
 * These automatically validate and return null for invalid values.
 */
const platformParser = parseAsStringEnum<SupportedPlatform>(
  platformGuides.map(g => g.platform)
);

const guideParser = parseAsStringEnum<GuideKey | 'manual'>([
  ...platformGuides.flatMap(p => p.guides.map(g => g.key)),
  'manual',
]);

interface Options {
  /**
   * Default guide to use if not present in URL.
   */
  defaultGuide?: GuideKey | 'manual';
  /**
   * Default platform to use if not present in URL.
   */
  defaultPlatform?: SupportedPlatform;
}

interface PlatformGuideState {
  /**
   * The selected Crons platform guide
   */
  guide: CronsPlatformGuide | null;
  /**
   * The currently selected guide key, or null if no guide is selected or the guide is invalid.
   */
  guideKey: GuideKey | 'manual' | null;
  /**
   * Whether both platform and guide are valid (not null). Use this to
   * determine if the guide UI should be shown.
   */
  guideVisible: boolean;
  /**
   * The selected Crons platform
   */
  platform: CronsPlatform | null;
  /**
   * The currently selected platform, or null if no platform is selected or the platform is invalid.
   */
  platformKey: SupportedPlatform | null;
  /**
   * Function to navigate to a specific platform and guide combination. If
   * platform is null, both params are cleared. If guide is not provided,
   * defaults to the first guide for that platform or 'manual'.
   */
  setPlatformGuide: (
    selectedPlatform: SupportedPlatform | null,
    selectedGuide?: GuideKey | 'manual'
  ) => void;
}

/**
 * Custom hook to manage platform and guide query parameters using nuqs.
 */
export function useCronsUpsertGuideState(options?: Options): PlatformGuideState {
  const [{platform: platformKey, guide: guideKey}, setQueryParams] = useQueryStates(
    {
      platform: options?.defaultPlatform
        ? platformParser.withDefault(options.defaultPlatform)
        : platformParser,
      guide: options?.defaultGuide
        ? guideParser.withDefault(options.defaultGuide)
        : guideParser,
    },
    {
      history: 'replace',
    }
  );

  const guideVisible = platformKey !== null && guideKey !== null;

  const setPlatformGuide = useCallback(
    (selectedPlatform: SupportedPlatform | null, selectedGuide?: GuideKey | 'manual') => {
      if (!selectedPlatform) {
        setQueryParams({platform: null, guide: null});
        return;
      }

      const targetGuide =
        selectedGuide ??
        platformGuides.find(g => g.platform === selectedPlatform)?.guides?.[0]?.key ??
        'manual';

      setQueryParams({platform: selectedPlatform, guide: targetGuide});
    },
    [setQueryParams]
  );

  const platform = platformGuides.find(v => v.platform === platformKey) ?? null;
  const guide = platform?.guides.find(g => g.key === guideKey) ?? null;

  return {
    platformKey,
    platform,
    guideKey,
    guide,
    guideVisible,
    setPlatformGuide,
  };
}

/**
 * Translates a `PlatformKey` to a Cron `SupportedPlatform` key.
 */
export function toSupportedPlatform(platform: PlatformKey) {
  return platformParser.parse(platform) ?? undefined;
}
