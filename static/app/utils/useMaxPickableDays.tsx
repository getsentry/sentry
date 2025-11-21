import {useMemo, type ReactNode} from 'react';

import HookOrDefault from 'sentry/components/hookOrDefault';
import type {DatePageFilterProps} from 'sentry/components/organizations/datePageFilter';
import {t} from 'sentry/locale';
import {DataCategory} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import {defined} from 'sentry/utils';

export interface MaxPickableDaysOptions {
  /**
   * The maximum number of days the user is allowed to pick on the date page filter
   */
  maxPickableDays: DatePageFilterProps['maxPickableDays'];
  /**
   * The maximum number of days the user can upgrade to on the date page filter
   */
  maxUpgradableDays: DatePageFilterProps['maxPickableDays'];
  defaultPeriod?: DatePageFilterProps['defaultPeriod'];
  upsellFooter?: ReactNode;
}

interface UseMaxPickableDaysProps {
  dataCategories: DataCategory[];
  organization: Organization;
}

export function useMaxPickableDays({
  dataCategories,
  organization,
}: UseMaxPickableDaysProps): MaxPickableDaysOptions {
  return useMemo(() => {
    function getMaxPickableDaysFor(dataCategory: DataCategory) {
      return getMaxPickableDays(dataCategory, organization);
    }

    return getBestMaxPickableDays(dataCategories, getMaxPickableDaysFor);
  }, [dataCategories, organization]);
}

function getBestMaxPickableDays(
  dataCategories: DataCategory[],
  getMaxPickableDaysFor: (dataCategory: DataCategory) => MaxPickableDaysOptions
) {
  let maxPickableDays: MaxPickableDaysOptions = {
    maxPickableDays: undefined,
    maxUpgradableDays: undefined,
  };

  for (const dataCategory of dataCategories) {
    const maxPickableDaysForDataCategory = getMaxPickableDaysFor(dataCategory);
    maxPickableDays = max(maxPickableDays, maxPickableDaysForDataCategory);
  }

  return maxPickableDays;
}

function max(
  a: MaxPickableDaysOptions,
  b: MaxPickableDaysOptions
): MaxPickableDaysOptions {
  if (!defined(a.maxPickableDays)) {
    return b;
  }

  if (!defined(b.maxPickableDays)) {
    return a;
  }

  if (a.maxPickableDays > b.maxPickableDays) {
    return a;
  }

  if (a.maxPickableDays < b.maxPickableDays) {
    return b;
  }

  if (!defined(a.maxUpgradableDays)) {
    return b;
  }

  if (!defined(b.maxUpgradableDays)) {
    return a;
  }

  if (a.maxUpgradableDays > b.maxUpgradableDays) {
    return a;
  }

  return b;
}

const DESCRIPTION = t('To query over longer time ranges, upgrade to Business');

function getMaxPickableDays(
  dataCategory: DataCategory,
  organization: Organization
): MaxPickableDaysOptions {
  switch (dataCategory) {
    case DataCategory.SPANS:
    case DataCategory.SPANS_INDEXED: {
      const maxPickableDays = organization.features.includes(
        'visibility-explore-range-high'
      )
        ? 90
        : 30;
      return {
        maxPickableDays,
        maxUpgradableDays: 90,
        upsellFooter: <UpsellFooterHook description={DESCRIPTION} source="spans" />,
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
    default:
      return {
        maxPickableDays: undefined,
        maxUpgradableDays: undefined,
      };
  }
}

const UpsellFooterHook = HookOrDefault({
  hookName: 'component:header-date-page-filter-upsell-footer',
  defaultComponent: () => null,
});
