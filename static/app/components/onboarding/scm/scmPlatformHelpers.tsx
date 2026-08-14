import {PlatformIcon} from 'platformicons';

import {SupportedLanguages} from 'sentry/components/onboarding/frameworkSuggestionModal';
import {ProductSolution} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {popularPlatformCategories} from 'sentry/data/platformPickerCategories';
import {platforms} from 'sentry/data/platforms';
import {t} from 'sentry/locale';
import type {OnboardingSelectedSDK} from 'sentry/types/onboarding';
import type {PlatformKey} from 'sentry/types/platform';
import type {PlatformIntegration} from 'sentry/types/project';
import {comparePlatformNames} from 'sentry/utils/platform';

import type {DetectedPlatform} from './useScmPlatformDetection';

export interface ResolvedPlatform extends DetectedPlatform {
  info: PlatformIntegration;
}

export const FEATURE_DISPLAY_ORDER: ProductSolution[] = [
  ProductSolution.ERROR_MONITORING,
  ProductSolution.LOGS,
  ProductSolution.SESSION_REPLAY,
  ProductSolution.PERFORMANCE_MONITORING,
  ProductSolution.PROFILING,
  ProductSolution.METRICS,
];

// Selecting or changing a platform resets the feature selection to error
// monitoring only; the feature panel also falls back to this when nothing is
// selected yet. Shared so both stay in lockstep. Treat as read-only; callers
// spread it into new arrays rather than mutating it.
export const DEFAULT_SCM_FEATURES: ProductSolution[] = [ProductSolution.ERROR_MONITORING];

const platformsByKey = new Map(platforms.map(p => [p.id, p]));

export const getPlatformInfo = (key: PlatformKey) => platformsByKey.get(key);

export const toPlatformOption = (platform: PlatformIntegration) => ({
  value: platform.id,
  label: platform.name,
  textValue: `${platform.name} ${platform.id}`,
  leadingItems: <PlatformIcon platform={platform.id} size={16} alt="" />,
});

// A flat A-Z list buries the platforms most users want, and a popularity sort
// reads as random without a visible boundary. Section the dropdown instead:
// the existing curated Popular list first (same order as the legacy Popular
// tab), then everything else under a labeled heading, ordered like the legacy
// picker's All tab.
export const platformOptionGroups = [
  {
    label: t('Popular'),
    options: Array.from(popularPlatformCategories)
      .map(key => platformsByKey.get(key))
      .filter(platform => platform !== undefined)
      .map(toPlatformOption),
  },
  {
    label: t('Other platforms'),
    options: platforms
      .filter(platform => !popularPlatformCategories.has(platform.id))
      .toSorted((a, b) => comparePlatformNames(a.name, b.name))
      .map(toPlatformOption),
  },
].filter(group => group.options.length > 0);

export const platformOptions = platformOptionGroups.flatMap(group => group.options);

export function toSelectedSdk(info: PlatformIntegration): OnboardingSelectedSDK {
  return {
    key: info.id,
    name: info.name,
    language: info.language,
    type: info.type,
    link: info.link,
    // PlatformIntegration doesn't carry a category — 'all' is the most
    // neutral value and avoids implying a specific picker category.
    category: 'all',
  };
}

export function shouldSuggestFramework(platformKey: PlatformKey): boolean {
  const info = getPlatformInfo(platformKey);
  return (
    info?.type === 'language' &&
    Object.values(SupportedLanguages).includes(info.language as SupportedLanguages)
  );
}

export function getPlatformName(platformKey: PlatformKey | undefined) {
  if (!platformKey) {
    return;
  }
  return getPlatformInfo(platformKey)?.name;
}
