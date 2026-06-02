import {skipToken, useQuery} from '@tanstack/react-query';

import {ProductSolution} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {t} from 'sentry/locale';
import {DataCategory} from 'sentry/types/core';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {useOrganization} from 'sentry/utils/useOrganization';
import {
  FALLBACK_FEATURE_META,
  type FeatureMeta,
  type UseScmFeatureMetaResult,
} from 'sentry/views/onboarding/components/useScmFeatureMeta';

import {DEFAULT_TIER} from 'getsentry/constants';
import {useSubscription} from 'getsentry/hooks/useSubscription';
import type {BillingConfig, Plan, Subscription} from 'getsentry/types';
import {formatReservedWithUnits, isUnlimitedReserved} from 'getsentry/utils/billing';

type DynamicCategoryFormat = {
  category: DataCategory;
  formatQuantity: (events: number) => string;
  formatTooltip: (quantity: string) => string;
  formatVolume: (quantity: string) => string;
};

// Categories whose free-plan volume is sourced from billing-config. PROFILING is
// intentionally absent — its free-plan duration is 0 and the fallback "Usage-based"
// copy is what we want to keep showing.
const DYNAMIC_FORMATS: Partial<Record<ProductSolution, DynamicCategoryFormat>> = {
  [ProductSolution.ERROR_MONITORING]: {
    category: DataCategory.ERRORS,
    formatQuantity: events => formatReservedWithUnits(events, DataCategory.ERRORS),
    formatVolume: quantity => t('%s errors / mo', quantity),
    formatTooltip: quantity =>
      t(
        'Free plan includes %s errors / month. Upgrade to Team or Business to send more.',
        quantity
      ),
  },
  [ProductSolution.PERFORMANCE_MONITORING]: {
    category: DataCategory.SPANS,
    formatQuantity: events =>
      formatReservedWithUnits(events, DataCategory.SPANS, {isAbbreviated: true}),
    formatVolume: quantity => t('%s spans / mo', quantity),
    formatTooltip: quantity =>
      t(
        'Free plan includes %s spans / month. Upgrade to Team or Business to send more.',
        quantity
      ),
  },
  [ProductSolution.SESSION_REPLAY]: {
    category: DataCategory.REPLAYS,
    formatQuantity: events => formatReservedWithUnits(events, DataCategory.REPLAYS),
    formatVolume: quantity => t('%s replays / mo', quantity),
    formatTooltip: quantity =>
      t(
        'Free plan includes %s replays / month. Upgrade to Team or Business to send more.',
        quantity
      ),
  },
  [ProductSolution.LOGS]: {
    category: DataCategory.LOG_BYTE,
    formatQuantity: gigabytes =>
      formatReservedWithUnits(gigabytes, DataCategory.LOG_BYTE),
    formatVolume: quantity => t('%s logs / mo', quantity),
    formatTooltip: quantity =>
      t(
        'Free plan includes %s logs / month. Upgrade to Team or Business to send more.',
        quantity
      ),
  },
  [ProductSolution.METRICS]: {
    category: DataCategory.TRACE_METRIC_BYTE,
    formatQuantity: gigabytes =>
      formatReservedWithUnits(gigabytes, DataCategory.TRACE_METRIC_BYTE),
    formatVolume: quantity => t('%s / mo', quantity),
    formatTooltip: quantity =>
      t(
        'Free plan includes %s metrics / month. Upgrade to Team or Business to send more.',
        quantity
      ),
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
 * Free-plan volumes sourced from the default-tier billing-config, with the
 * "upgrade to Team or Business" framing. Used for new/trialing/free orgs.
 */
function buildFreePlanMeta(freePlan: Plan): Record<ProductSolution, FeatureMeta> {
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
    const quantity = format.formatQuantity(events);
    meta[product] = {
      ...FALLBACK_FEATURE_META[product],
      volume: format.formatVolume(quantity),
      volumeTooltip: format.formatTooltip(quantity),
    };
  }
  return meta;
}

/**
 * Volumes sourced from the org's own reserved quotas, dropping the upgrade CTA.
 * Used for paid orgs, where the free-plan limits and "upgrade" copy are wrong.
 */
function buildCurrentPlanMeta(
  subscription: Subscription
): Record<ProductSolution, FeatureMeta> {
  const meta: Record<ProductSolution, FeatureMeta> = {...FALLBACK_FEATURE_META};
  for (const [productKey, format] of Object.entries(DYNAMIC_FORMATS)) {
    if (!format) {
      continue;
    }
    const product = productKey as ProductSolution;
    const reserved = subscription.categories[format.category]?.reserved;

    let volume: string;
    if (isUnlimitedReserved(reserved)) {
      volume = t('Unlimited');
    } else if (typeof reserved !== 'number' || reserved <= 0) {
      // Reserved-budget / pay-as-you-go / unmetered on this plan: there is no
      // fixed monthly volume to advertise.
      volume = t('Usage-based');
    } else {
      volume = format.formatVolume(format.formatQuantity(reserved));
    }

    meta[product] = {
      ...FALLBACK_FEATURE_META[product],
      volume,
      volumeTooltip: t('Included with your current plan.'),
    };
  }
  return meta;
}

/**
 * gsApp implementation of `useScmFeatureMeta`. Keeps the SCM onboarding feature
 * cards aligned with the volumes the viewer actually gets.
 *
 * Paid, non-trial orgs see their own plan's reserved volumes. New, trialing, and
 * free orgs — and any org whose subscription hasn't loaded yet — fall through to
 * the default-tier free-plan billing-config, which is the baseline a trial
 * converts into and the correct copy for the free plan. Reports isLoading while
 * the billing-config request is in flight, and falls back to the OSS static copy
 * on error.
 */
export function useScmFeatureMeta(): UseScmFeatureMetaResult {
  const organization = useOrganization();
  const subscription = useSubscription();

  const isPaid = !!subscription && !subscription.isFree && !subscription.isTrial;

  const {data: billingConfig, isLoading} = useQuery({
    ...apiOptions.as<BillingConfig>()(
      '/customers/$organizationIdOrSlug/billing-config/',
      {
        // Paid orgs read volumes off their subscription, so skip the free-plan
        // billing-config fetch entirely.
        path: isPaid ? skipToken : {organizationIdOrSlug: organization.slug},
        query: {tier: DEFAULT_TIER},
        staleTime: Infinity,
      }
    ),
    retry: false,
  });

  if (isPaid && subscription) {
    return {meta: buildCurrentPlanMeta(subscription), isLoading: false};
  }

  if (!billingConfig) {
    return {meta: FALLBACK_FEATURE_META, isLoading};
  }

  const freePlan = findFreePlan(billingConfig.planList, billingConfig.freePlan);
  if (!freePlan) {
    return {meta: FALLBACK_FEATURE_META, isLoading: false};
  }

  return {meta: buildFreePlanMeta(freePlan), isLoading: false};
}
