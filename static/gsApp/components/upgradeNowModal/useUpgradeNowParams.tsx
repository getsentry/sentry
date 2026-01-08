import {useMemo} from 'react';

import type {Organization} from 'sentry/types/organization';
import {useApiQuery} from 'sentry/utils/queryClient';

import type {BillingConfig, Plan, Subscription} from 'getsentry/types';
import {PlanTier} from 'getsentry/types';
import {hasPerformance} from 'getsentry/utils/billing';
import {getBucket} from 'getsentry/views/amCheckout/utils';

import type {Reservations} from './types';

type Opts = {
  organization: Organization;
  subscription: Subscription;
  enabled?: boolean;
};

type State = {
  plan: undefined | Plan;
  reservations: undefined | Reservations;
};

const DEFAULT_STATE: State = {plan: undefined, reservations: undefined};

function canComparePrices(subscription: Subscription, initialPlan: Plan) {
  return (
    // MMx event buckets are priced differently
    hasPerformance(subscription?.planDetails) &&
    subscription.planDetails.name === initialPlan.name &&
    subscription.planDetails.billingInterval === initialPlan.billingInterval
  );
}

function useUpgradeNowParams({organization, subscription, enabled = true}: Opts) {
  const {isPending, data: billingConfig} = useApiQuery<BillingConfig>(
    [
      `/customers/${organization.slug}/billing-config/`,
      {
        query: {
          tier: PlanTier.AM2,
        },
      },
    ],
    {staleTime: 0, enabled}
  );

  const result = useMemo(() => {
    if (isPending || !billingConfig || !enabled) {
      return DEFAULT_STATE;
    }

    const am2Plan = billingConfig.planList.find(
      plan =>
        plan.basePrice &&
        plan.userSelectable &&
        plan.billingInterval === subscription.billingInterval &&
        plan.contractInterval === subscription.contractInterval &&
        plan.name === subscription.planDetails?.name
    );

    if (!am2Plan) {
      return DEFAULT_STATE;
    }

    const initialPlan = subscription.planDetails;
    const canCompare = canComparePrices(subscription, initialPlan);

    const reserved = Object.fromEntries(
      Object.entries(subscription.planDetails.planCategories)
        // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
        .filter(([category]) => subscription.categories[category])
        .map(([category, eventBuckets]) => {
          // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
          const currentHistory = subscription.categories[category];
          let events = currentHistory?.reserved ?? 0;

          if (canCompare) {
            const price = getBucket({events, buckets: eventBuckets}).price;
            const eventsByPrice = getBucket({
              price,
              // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
              buckets: am2Plan.planCategories[category],
            }).events;
            events = Math.max(events, eventsByPrice);
          }
          return [category, events];
        })
    );

    return {
      plan: am2Plan,
      reservations: {
        reservedErrors: reserved.errors,
        reservedTransactions: reserved.transactions,
        reservedReplays: reserved.replays,
        reservedAttachments: reserved.attachments,
        reservedMonitorSeats: reserved.monitorSeats,
        reservedUptime: reserved.uptime,
        reservedProfileDuration: reserved.profileDuration,
        reservedProfileDurationUI: reserved.profileDurationUI,
        reservedLogBytes: reserved.logBytes,
        reservedSpans: reserved.spans,
        reservedSeerAutofix: reserved.seerAutofix,
        reservedSeerScanner: reserved.seerScanner,
        reservedSeerUsers: reserved.seerUsers,
      },
    };
  }, [billingConfig, isPending, subscription, enabled]);

  return result;
}

export default useUpgradeNowParams;
