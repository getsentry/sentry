import type {ReactNode} from 'react';

import type {ProductPageFiltersContextValue} from 'sentry/components/organizations/pageFilters/product/context';
import {t} from 'sentry/locale';
import {DataCategory} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';

export function getProductPageFiltersContainerContextValueForDataCategory(
  dataCategory: DataCategory,
  organization: Organization
): ProductPageFiltersContextValue {
  switch (dataCategory) {
    case DataCategory.SPANS:
      return getProductPageFiltersContainerContextValueForSpans(organization);
    case DataCategory.LOG_BYTE:
      return getProductPageFiltersContainerContextValueForLogs();
    default:
      return {};
  }
}

type MaxPickableDays = 7 | 14 | 30 | 90;
type DefaultPeriod = '24h' | '7d' | '14d' | '30d' | '90d';

function getProductPageFiltersContainerContextValueForSpans(
  organization: Organization
): ProductPageFiltersContextValue {
  const defaultPeriods: Record<MaxPickableDays, DefaultPeriod> = {
    7: '7d',
    14: '14d',
    30: '30d',
    90: '90d',
  };

  const relativeOptions: Array<[DefaultPeriod, ReactNode]> = [
    ['7d', t('Last 7 days')],
    ['14d', t('Last 14 days')],
    ['30d', t('Last 30 days')],
    ['90d', t('Last 90 days')],
  ];

  const maxPickableDays: MaxPickableDays = organization.features.includes(
    'visibility-explore-range-high'
  )
    ? 90
    : 30;
  const defaultPeriod: DefaultPeriod = defaultPeriods[maxPickableDays];

  const index = relativeOptions.findIndex(([period, _]) => period === defaultPeriod) + 1;
  const enabledOptions = Object.fromEntries(relativeOptions.slice(0, index));

  return {
    defaultPeriod,
    maxPickableDays,
    relativeOptions: ({
      arbitraryOptions,
    }: {
      arbitraryOptions: Record<string, ReactNode>;
    }) => ({
      ...arbitraryOptions,
      '1h': t('Last hour'),
      '24h': t('Last 24 hours'),
      ...enabledOptions,
    }),
  };
}

function getProductPageFiltersContainerContextValueForLogs(): ProductPageFiltersContextValue {
  const relativeOptions: Array<[string, ReactNode]> = [
    ['1h', t('Last hour')],
    ['24h', t('Last 24 hours')],
    ['7d', t('Last 7 days')],
    ['14d', t('Last 14 days')],
    ['30d', t('Last 30 days')],
  ];

  return {
    defaultPeriod: '24h',
    maxPickableDays: 30,
    relativeOptions: ({
      arbitraryOptions,
    }: {
      arbitraryOptions: Record<string, ReactNode>;
    }) => ({
      ...arbitraryOptions,
      ...Object.fromEntries(relativeOptions),
    }),
  };
}
