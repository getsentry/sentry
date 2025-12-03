import {useMemo, type ReactNode} from 'react';

import HookOrDefault from 'sentry/components/hookOrDefault';
import type {DatePageFilterProps} from 'sentry/components/organizations/datePageFilter';
import {MAX_PICKABLE_DAYS} from 'sentry/constants';
import {t} from 'sentry/locale';
import HookStore from 'sentry/stores/hookStore';
import {DataCategory} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import useOrganization from 'sentry/utils/useOrganization';

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
  return MAX_PICKABLE_DAYS;
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
  let maxPickableDays: MaxPickableDaysOptions = getMaxPickableDaysFor(dataCategories[0]);

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
  switch (dataCategory) {
    case DataCategory.SPANS:
    case DataCategory.SPANS_INDEXED: {
      const maxPickableDays = organization.features.includes(
        'visibility-explore-range-high'
      )
        ? MAX_PICKABLE_DAYS
        : 30;
      return {
        maxPickableDays,
        maxUpgradableDays: MAX_PICKABLE_DAYS,
        upsellFooter: SpansUpsellFooter,
      };
    }
    case DataCategory.TRACE_METRICS:
    case DataCategory.LOG_BYTE:
    case DataCategory.LOG_ITEM:
      return {
        maxPickableDays: 30,
        maxUpgradableDays: 30,
        defaultPeriod: '24h',
      };
    case DataCategory.PROFILE_CHUNKS:
    case DataCategory.PROFILE_CHUNKS_UI:
    case DataCategory.PROFILE_DURATION:
    case DataCategory.PROFILE_DURATION_UI:
    case DataCategory.TRANSACTIONS:
    case DataCategory.REPLAYS:
      return {
        maxPickableDays: MAX_PICKABLE_DAYS,
        maxUpgradableDays: MAX_PICKABLE_DAYS,
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
