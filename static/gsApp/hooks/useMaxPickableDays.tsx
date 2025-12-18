import {useMemo} from 'react';
import moment from 'moment-timezone';

import {MAX_PICKABLE_DAYS} from 'sentry/constants';
import {DataCategory} from 'sentry/types/core';
import {defined} from 'sentry/utils';
import {
  getBestMaxPickableDays,
  getMaxPickableDays,
  SpansUpsellFooter,
  type MaxPickableDaysOptions,
  type UseMaxPickableDaysProps,
} from 'sentry/utils/useMaxPickableDays';
import useOrganization from 'sentry/utils/useOrganization';

import type {Subscription} from 'getsentry/types';

import useSubscription from './useSubscription';

export function useDefaultMaxPickableDays() {
  const subscription = useSubscription();
  return subscription?.planDetails?.retentionDays ?? MAX_PICKABLE_DAYS;
}

export function useMaxPickableDays({
  dataCategories,
}: UseMaxPickableDaysProps): MaxPickableDaysOptions {
  const organization = useOrganization();
  const subscription = useSubscription();

  return useMemo(() => {
    function getMaxPickableDaysFor(dataCategory: DataCategory) {
      if (organization.features.includes('downsampled-date-page-filter')) {
        const maxPickableDays = getMaxPickableDaysBySubscription(
          dataCategory,
          subscription
        );
        if (defined(maxPickableDays)) {
          return maxPickableDays;
        }
      }
      const maxPickableDays = getLegacyMaxPickableDaysBySubscription(
        dataCategory,
        subscription
      );
      if (defined(maxPickableDays)) {
        return maxPickableDays;
      }
      return getMaxPickableDays(dataCategory, organization);
    }

    return getBestMaxPickableDays(dataCategories, getMaxPickableDaysFor);
  }, [dataCategories, organization, subscription]);
}

function getMaxPickableDaysBySubscription(
  dataCategory: DataCategory,
  subscription: Subscription | null
): MaxPickableDaysOptions | undefined {
  switch (dataCategory) {
    case DataCategory.SPANS:
    case DataCategory.SPANS_INDEXED: {
      // first day we started 13 months downsampled retention
      const firstAvailableDate = moment('2025-09-01');
      const now = moment();
      const elapsedDays = Math.max(0, Math.round(now.diff(firstAvailableDate, 'days')));

      const maxPickableDays = Math.min(
        elapsedDays, // only allow back up to the first available day
        Math.max(
          ...[
            30, // default 30 days retention
            subscription?.effectiveRetentions?.span?.standard,
            subscription?.effectiveRetentions?.span?.downsampled,
          ].filter<number>(defined)
        )
      );

      return {
        maxPickableDays,
        maxUpgradableDays: Math.max(
          90, // use 90 days as a placeholder, business plans get 13 months downsampled retention
          Math.min(maxPickableDays, elapsedDays)
        ),
        upsellFooter: SpansUpsellFooter,
      };
    }
    case DataCategory.TRACE_METRICS: {
      // TODO: undecided for now, fixed at 30 days
      return {
        maxPickableDays: 30,
        maxUpgradableDays: 30,
        defaultPeriod: '24h',
      };
    }
    case DataCategory.LOG_BYTE:
    case DataCategory.LOG_ITEM: {
      const maxPickableDays = Math.max(
        ...[
          30, // default 30 day retention
          subscription?.effectiveRetentions?.log?.standard,
          subscription?.effectiveRetentions?.log?.downsampled,
        ].filter<number>(defined)
      );
      return {
        maxPickableDays,
        maxUpgradableDays: Math.max(
          30, // use 30 as a placeholder, all plans get 30 days retention
          maxPickableDays
        ),
        defaultPeriod: '24h',
      };
    }
    case DataCategory.PROFILE_CHUNKS:
    case DataCategory.PROFILE_CHUNKS_UI:
    case DataCategory.PROFILE_DURATION:
    case DataCategory.PROFILE_DURATION_UI:
      return {
        maxPickableDays: 30,
        maxUpgradableDays: 30,
        defaultPeriod: '24h',
      };
    case DataCategory.TRANSACTIONS:
    case DataCategory.REPLAYS:
      return {
        maxPickableDays: subscription?.planDetails?.retentionDays ?? MAX_PICKABLE_DAYS,
        maxUpgradableDays: MAX_PICKABLE_DAYS,
      };
    default:
      return undefined;
  }
}

function getLegacyMaxPickableDaysBySubscription(
  dataCategory: DataCategory,
  subscription: Subscription | null
): MaxPickableDaysOptions | undefined {
  switch (dataCategory) {
    case DataCategory.PROFILE_CHUNKS:
    case DataCategory.PROFILE_CHUNKS_UI:
    case DataCategory.PROFILE_DURATION:
    case DataCategory.PROFILE_DURATION_UI:
      return {
        maxPickableDays: subscription?.planDetails?.retentionDays ?? MAX_PICKABLE_DAYS,
        maxUpgradableDays: MAX_PICKABLE_DAYS,
      };
    default:
      return undefined;
  }
}
