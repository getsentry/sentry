import {useMemo, type ReactNode} from 'react';

import type {SelectOptionWithKey} from 'sentry/components/core/compactSelect/types';
import type {DatePageFilterProps} from 'sentry/components/organizations/datePageFilter';
import {t} from 'sentry/locale';
import {isEmptyObject} from 'sentry/utils/object/isEmptyObject';
import type {MaxPickableDaysOptions} from 'sentry/utils/useMaxPickableDays';

interface UseDatePageFilterPropsProps extends MaxPickableDaysOptions {}

export function useDatePageFilterProps({
  defaultPeriod,
  maxPickableDays,
  maxUpgradableDays,
  upsellFooter,
}: UseDatePageFilterPropsProps): DatePageFilterProps {
  return useMemo(() => {
    // ensure the available relative options are always sorted
    const availableRelativeOptions: Array<[number, string, ReactNode]> = [
      [1 / 24, '1h', t('Last hour')],
      [1, '24h', t('Last 24 hours')],
      [7, '7d', t('Last 7 days')],
      [14, '14d', t('Last 14 days')],
      [30, '30d', t('Last 30 days')],
      [90, '90d', t('Last 90 days')],
    ];

    // find the relative options that should be enabled based on the maxPickableDays
    const pickableIndex =
      availableRelativeOptions.findLastIndex(([days]) => days <= maxPickableDays) + 1;
    const enabledOptions = Object.fromEntries(
      availableRelativeOptions
        .slice(0, pickableIndex)
        .map(([_, period, label]) => [period, label])
    );

    // find the relative options that should be disabled based on the maxUpgradableDays
    const upgradableIndex =
      availableRelativeOptions.findLastIndex(([days]) => days <= maxUpgradableDays) + 1;
    const disabledOptions = Object.fromEntries(
      availableRelativeOptions
        .slice(pickableIndex, upgradableIndex)
        .map(([_, period, label]) => [period, label])
    );

    const isOptionDisabled = (option: SelectOptionWithKey<string>): boolean => {
      return disabledOptions.hasOwnProperty(option.value);
    };

    const menuFooter = isEmptyObject(disabledOptions) ? null : (upsellFooter ?? null);

    return {
      defaultPeriod,
      isOptionDisabled,
      maxPickableDays,
      menuFooter,
      relativeOptions: ({arbitraryOptions}) => ({
        ...arbitraryOptions,
        ...enabledOptions,
        ...disabledOptions,
      }),
    };
  }, [defaultPeriod, maxPickableDays, maxUpgradableDays, upsellFooter]);
}
