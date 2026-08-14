import {PlatformIcon} from 'platformicons';

import {SupportedLanguages} from 'sentry/components/onboarding/frameworkSuggestionModal';
import {ProductSolution} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {categoryList} from 'sentry/data/platformPickerCategories';
import {platforms} from 'sentry/data/platforms';
import {t} from 'sentry/locale';
import type {OnboardingSelectedSDK} from 'sentry/types/onboarding';
import type {PlatformKey} from 'sentry/types/platform';
import type {PlatformIntegration} from 'sentry/types/project';

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

function makePlatformOption(platform: PlatformIntegration) {
  return {
    value: platform.id,
    label: platform.name,
    textValue: `${platform.name} ${platform.id}`,
    leadingItems: <PlatformIcon platform={platform.id} size={16} alt="" />,
  };
}

export const platformOptions = platforms.map(makePlatformOption);

function makePlatformOptionGroups() {
  const platformOptionsByKey = new Map(
    platformOptions.map(option => [option.value, option])
  );
  const assignedPlatforms = new Set<PlatformKey>();

  const groups = categoryList
    .filter(category => category.id !== 'all')
    .map(category => {
      const options = Array.from(category.platforms)
        .filter(platform => !assignedPlatforms.has(platform))
        .map(platform => platformOptionsByKey.get(platform))
        .filter(option => option !== undefined);

      options.forEach(option => assignedPlatforms.add(option.value));

      return {
        label: category.name,
        options:
          category.id === 'popular'
            ? options
            : options.toSorted((a, b) => a.label.localeCompare(b.label)),
      };
    });

  groups.push({
    label: t('Other'),
    options: platformOptions
      .filter(option => !assignedPlatforms.has(option.value))
      .toSorted((a, b) => a.label.localeCompare(b.label)),
  });

  return groups.filter(group => group.options.length > 0);
}

export const platformOptionGroups = makePlatformOptionGroups();

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
