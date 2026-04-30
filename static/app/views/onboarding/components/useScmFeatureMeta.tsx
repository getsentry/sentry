import type {ComponentType} from 'react';

import {ProductSolution} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {
  IconGraph,
  IconProfiling,
  IconSpan,
  IconTerminal,
  IconTimer,
  IconWarning,
} from 'sentry/icons';
import type {SVGIconProps} from 'sentry/icons/svgIcon';
import {t} from 'sentry/locale';
import {DataCategory} from 'sentry/types/core';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {useApiQuery} from 'sentry/utils/queryClient';
import {useOrganization} from 'sentry/utils/useOrganization';

/* eslint-disable boundaries/dependencies */
import {UPSELL_TIER} from 'getsentry/constants';
import {useSubscription} from 'getsentry/hooks/useSubscription';
import {type BillingConfig, type Plan, PlanTier} from 'getsentry/types';
import {formatReservedWithUnits} from 'getsentry/utils/billing';
/* eslint-enable boundaries/dependencies */

export type FeatureMeta = {
  description: string;
  icon: ComponentType<SVGIconProps>;
  label: string;
  volume: string;
  volumeTooltip: string;
  alwaysEnabled?: boolean;
};

export const FALLBACK_FEATURE_META: Record<ProductSolution, FeatureMeta> = {
  [ProductSolution.ERROR_MONITORING]: {
    label: t('Error monitoring'),
    icon: IconWarning,
    description: t('Automatically capture exceptions and stack traces'),
    alwaysEnabled: true,
    volume: t('5,000 errors / mo'),
    volumeTooltip: t(
      'Free plan includes 5,000 errors / month. Upgrade to Team or Business to send more.'
    ),
  },
  [ProductSolution.PERFORMANCE_MONITORING]: {
    label: t('Tracing'),
    icon: IconSpan,
    description: t(
      'Find bottlenecks, broken requests, and understand application flow end-to-end'
    ),
    volume: t('5M spans / mo'),
    volumeTooltip: t(
      'Free plan includes 5M spans / month. Upgrade to Team or Business to send more.'
    ),
  },
  [ProductSolution.SESSION_REPLAY]: {
    label: t('Session replay'),
    icon: IconTimer,
    description: t('Watch real user sessions to see what went wrong'),
    volume: t('50 replays / mo'),
    volumeTooltip: t(
      'Free plan includes 50 replays / month. Upgrade to Team or Business to send more.'
    ),
  },
  [ProductSolution.LOGS]: {
    label: t('Logging'),
    icon: IconTerminal,
    description: t('See logs in context with errors and performance issues'),
    volume: t('5 GB logs / mo'),
    volumeTooltip: t(
      'Free plan includes 5 GB logs / month. Upgrade to Team or Business to send more.'
    ),
  },
  [ProductSolution.PROFILING]: {
    label: t('Profiling'),
    icon: IconProfiling,
    description: t(
      'Pinpoint the functions and lines of code responsible for performance issues'
    ),
    volume: t('Usage-based'),
    volumeTooltip: t('Upgrade to Team or Business to send more.'),
  },
  [ProductSolution.METRICS]: {
    label: t('Application Metrics'),
    icon: IconGraph,
    description: t(
      'Track application performance and usage over time with custom metrics'
    ),
    volume: t('5 GB / mo'),
    volumeTooltip: t('Free plan includes 5 GB metrics / month'),
  },
};

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

function getUpsellTier(planTier?: string, trialTier?: string | null) {
  return planTier === PlanTier.AM3 || trialTier === PlanTier.AM3
    ? PlanTier.AM3
    : UPSELL_TIER;
}

/**
 * Returns the per-product metadata used to render SCM onboarding feature cards.
 *
 * Volume strings (e.g. "5,000 errors / mo") and matching tooltips are derived
 * from the active org's billing-config response so they stay aligned with the
 * actual free-plan limits. When the response isn't available — self-hosted,
 * unhydrated subscription store, query in flight, or query errored — the
 * static FALLBACK_FEATURE_META is returned so the UI still renders sensible
 * copy.
 */
export function useScmFeatureMeta(): Record<ProductSolution, FeatureMeta> {
  const organization = useOrganization();
  const subscription = useSubscription();
  const upsellTier = getUpsellTier(subscription?.planTier, subscription?.trialTier);
  const {data: billingConfig} = useApiQuery<BillingConfig>(
    [
      getApiUrl('/customers/$organizationIdOrSlug/billing-config/', {
        path: {organizationIdOrSlug: organization.slug},
      }),
      {query: {tier: upsellTier}},
    ],
    {staleTime: Infinity, enabled: !!subscription, retry: false}
  );

  if (!subscription || !billingConfig) {
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
