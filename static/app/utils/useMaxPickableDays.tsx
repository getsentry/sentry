import {useMemo, type ReactNode} from 'react';

import {HookOrDefault} from 'sentry/components/hookOrDefault';
import type {DatePageFilterProps} from 'sentry/components/pageFilters/date/datePageFilter';
import {MAX_PICKABLE_DAYS} from 'sentry/constants';
import {t} from 'sentry/locale';
import {ConfigStore} from 'sentry/stores/configStore';
import {HookStore} from 'sentry/stores/hookStore';
import {DataCategory} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import {useOrganization} from 'sentry/utils/useOrganization';

export const INCREASED_MAX_PICKABLE_DAYS = 180;
export const INCREASED_MAX_PICKABLE_DAYS_FEATURE =
  'visibility-increased-max-pickable-days';

/**
 * This returns the default max pickable days for the current organization.
 *
 * Use this as the default when there is not known data category.
 */
export function useDefaultMaxPickableDays(): number {
  const useDefaultMaxPickableDaysHook =
    HookStore.get('react-hook:use-default-max-pickable-days')[0] ??
    useDefaultMaxPickableDaysImpl;
  return useDefaultMaxPickableDaysHook();
}

function useDefaultMaxPickableDaysImpl() {
  const organization = useOrganization({allowNull: true});
  return getDefaultMaxPickableDays(organization);
}

export function getDefaultMaxPickableDays(
  organization: Organization | null | undefined
): number {
  if (isIncreasedMaxPickableDaysEnabled(organization)) {
    return INCREASED_MAX_PICKABLE_DAYS;
  }

  return MAX_PICKABLE_DAYS;
}

export function isIncreasedMaxPickableDaysEnabled(
  organization: Organization | null | undefined
): boolean {
  return Boolean(
    ConfigStore.get('isSelfHosted') &&
      organization?.features.includes(INCREASED_MAX_PICKABLE_DAYS_FEATURE)
  );
}

export interface MaxPickableDaysOptions {
  /**
   * The maximum number of days the user is allowed to pick on the date page filter
   */
  maxPickableDays: NonNullable<DatePageFilterProps['maxPickableDays']>;
  /**
   * The maximum number of days the user can upgrade to on the date page filter
   */
  maxUpgradableDays: NonNullable<DatePageFilterProps['maxPickableDays']>;
  defaultPeriod?: DatePageFilterProps['defaultPeriod'];
  upsellFooter?: ReactNode;
}

export interface UseMaxPickableDaysProps {
  dataCategories: readonly [DataCategory, ...DataCategory[]];
}

export function useMaxPickableDays({
  dataCategories,
}: UseMaxPickableDaysProps): MaxPickableDaysOptions {
  const useMaxPickableDaysHook =
    HookStore.get('react-hook:use-max-pickable-days')[0] ?? useMaxPickableDaysImpl;
  return useMaxPickableDaysHook({dataCategories});
}

function useMaxPickableDaysImpl({dataCategories}: UseMaxPickableDaysProps) {
  const organization = useOrganization();
  return useMemo(() => {
    function getMaxPickableDaysFor(dataCategory: DataCategory) {
      return getMaxPickableDays(dataCategory, organization);
    }

    return getBestMaxPickableDays(dataCategories, getMaxPickableDaysFor);
  }, [dataCategories, organization]);
}

export function getBestMaxPickableDays(
  dataCategories: readonly [DataCategory, ...DataCategory[]],
  getMaxPickableDaysFor: (dataCategory: DataCategory) => MaxPickableDaysOptions
) {
  let maxPickableDays = getMaxPickableDaysFor(dataCategories[0]);

  for (let i = 1; i < dataCategories.length; i++) {
    const dataCategory = dataCategories[i]!;
    const maxPickableDaysForDataCategory = getMaxPickableDaysFor(dataCategory);
    maxPickableDays = max(maxPickableDays, maxPickableDaysForDataCategory);
  }

  return maxPickableDays;
}

function max(
  a: MaxPickableDaysOptions,
  b: MaxPickableDaysOptions
): MaxPickableDaysOptions {
  if (a.maxPickableDays < b.maxPickableDays) {
    return b;
  }

  if (a.maxUpgradableDays < b.maxUpgradableDays) {
    return b;
  }

  return a;
}

const DESCRIPTION = t('To query over longer time ranges, upgrade to Business');

export function getMaxPickableDays(
  dataCategory: DataCategory,
  organization: Organization
): MaxPickableDaysOptions {
  const defaultMaxPickableDays = getDefaultMaxPickableDays(organization);
  const hasIncreasedMaxPickableDays = isIncreasedMaxPickableDaysEnabled(organization);

  switch (dataCategory) {
    case DataCategory.SPANS:
    case DataCategory.SPANS_INDEXED: {
      let maxPickableDays = 30;

      if (hasIncreasedMaxPickableDays) {
        maxPickableDays = defaultMaxPickableDays;
      } else if (organization.features.includes('visibility-explore-range-high')) {
        maxPickableDays = MAX_PICKABLE_DAYS;
      }

      return {
        maxPickableDays,
        maxUpgradableDays: hasIncreasedMaxPickableDays
          ? defaultMaxPickableDays
          : MAX_PICKABLE_DAYS,
        upsellFooter: SpansUpsellFooter,
      };
    }
    case DataCategory.TRACE_METRICS:
    case DataCategory.LOG_BYTE:
    case DataCategory.LOG_ITEM:
      return {
        maxPickableDays: hasIncreasedMaxPickableDays ? defaultMaxPickableDays : 30,
        maxUpgradableDays: hasIncreasedMaxPickableDays ? defaultMaxPickableDays : 30,
        defaultPeriod: '24h',
      };
    case DataCategory.PROFILE_CHUNKS:
    case DataCategory.PROFILE_CHUNKS_UI:
    case DataCategory.PROFILE_DURATION:
    case DataCategory.PROFILE_DURATION_UI:
    case DataCategory.TRANSACTIONS:
    case DataCategory.REPLAYS:
      return {
        maxPickableDays: defaultMaxPickableDays,
        maxUpgradableDays: defaultMaxPickableDays,
      };
    default:
      throw new Error(
        `Unsupported data category: ${dataCategory} for getMaxPickableDays`
      );
  }
}

const UpsellFooterHook = HookOrDefault({
  hookName: 'component:header-date-page-filter-upsell-footer',
  defaultComponent: () => null,
});

export const SpansUpsellFooter = (
  <UpsellFooterHook description={DESCRIPTION} source="spans" />
);
