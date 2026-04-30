import {ProductSolution} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {t} from 'sentry/locale';
import {DataCategory} from 'sentry/types/core';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {useApiQuery} from 'sentry/utils/queryClient';
import {useOrganization} from 'sentry/utils/useOrganization';
import {
  FALLBACK_FEATURE_META,
  type FeatureMeta,
} from 'sentry/views/onboarding/components/useScmFeatureMeta';

import {DEFAULT_TIER} from 'getsentry/constants';
import type {BillingConfig, Plan} from 'getsentry/types';
import {formatReservedWithUnits} from 'getsentry/utils/billing';

type DynamicCategoryFormat = {
  category: DataCategory;
  formatTooltip: (formattedVolume: string) => string;
  formatVolume: (events: number) => string;
};

// Categories whose free-plan volume is sourced from billing-config. Profiling is
// intentionally excluded — its free volume is 0 and the fallback "Usage-based" copy
// is what we want to keep showing.
const DYNAMIC_FORMATS: Partial<Record<ProductSolution, DynamicCategoryFormat>> = {
  [ProductSolution.ERROR_MONITORING]: {
    category: DataCategory.ERRORS,
    formatVolume: events =>
      t('%s errors / mo', formatReservedWithUnits(events, DataCategory.ERRORS)),
    formatTooltip: volume =>
      t(
        'Free plan includes %s. Upgrade to Team or Business to send more.',
        volume.replace(/ \/ mo$/, ' / month')
      ),
  },
  [ProductSolution.PERFORMANCE_MONITORING]: {
    category: DataCategory.SPANS,
    formatVolume: events =>
      t(
        '%s spans / mo',
        formatReservedWithUnits(events, DataCategory.SPANS, {isAbbreviated: true})
      ),
    formatTooltip: volume =>
      t(
        'Free plan includes %s. Upgrade to Team or Business to send more.',
        volume.replace(/ \/ mo$/, ' / month')
      ),
  },
  [ProductSolution.SESSION_REPLAY]: {
    category: DataCategory.REPLAYS,
    formatVolume: events =>
      t('%s replays / mo', formatReservedWithUnits(events, DataCategory.REPLAYS)),
    formatTooltip: volume =>
      t(
        'Free plan includes %s. Upgrade to Team or Business to send more.',
        volume.replace(/ \/ mo$/, ' / month')
      ),
  },
  [ProductSolution.LOGS]: {
    category: DataCategory.LOG_BYTE,
    formatVolume: gigabytes =>
      t('%s logs / mo', formatReservedWithUnits(gigabytes, DataCategory.LOG_BYTE)),
    formatTooltip: volume =>
      t(
        'Free plan includes %s. Upgrade to Team or Business to send more.',
        volume.replace(/ \/ mo$/, ' / month')
      ),
  },
  [ProductSolution.METRICS]: {
    category: DataCategory.TRACE_METRIC_BYTE,
    formatVolume: gigabytes =>
      t('%s / mo', formatReservedWithUnits(gigabytes, DataCategory.TRACE_METRIC_BYTE)),
    formatTooltip: volume =>
      t('Free plan includes %s metrics / month.', volume.replace(/ \/ mo$/, '')),
  },
};

function findFreePlan(planList: Plan[], freePlanId: string): Plan | undefined {
  return planList.find(plan => plan.id === freePlanId);
}

function getFreeVolume(plan: Plan, category: DataCategory): number | undefined {
  const buckets = plan.planCategories[category];
  return buckets?.[0]?.events;
}

/**
 * gsApp implementation of `useScmFeatureMeta`. Sources free-plan volume strings
 * from the default-tier billing-config response so the SCM onboarding cards stay
 * aligned with the actual free-plan limits. Falls back to the OSS static copy
 * while the request is in flight or if it fails.
 */
export function useScmFeatureMeta(): Record<ProductSolution, FeatureMeta> {
  const organization = useOrganization();
  const {data: billingConfig} = useApiQuery<BillingConfig>(
    [
      getApiUrl('/customers/$organizationIdOrSlug/billing-config/', {
        path: {organizationIdOrSlug: organization.slug},
      }),
      {query: {tier: DEFAULT_TIER}},
    ],
    {staleTime: Infinity, retry: false}
  );

  if (!billingConfig) {
    return FALLBACK_FEATURE_META;
  }

  const freePlan = findFreePlan(billingConfig.planList, billingConfig.freePlan);
  if (!freePlan) {
    return FALLBACK_FEATURE_META;
  }

  const meta: Record<ProductSolution, FeatureMeta> = {...FALLBACK_FEATURE_META};
  for (const [productKey, format] of Object.entries(DYNAMIC_FORMATS)) {
    if (!format) {
      continue;
    }
    const product = productKey as ProductSolution;
    const events = getFreeVolume(freePlan, format.category);
    if (events === undefined || events <= 0) {
      continue;
    }
    const volume = format.formatVolume(events);
    meta[product] = {
      ...FALLBACK_FEATURE_META[product],
      volume,
      volumeTooltip: format.formatTooltip(volume),
    };
  }

  return meta;
}
