import {Fragment} from 'react';

import type {Organization} from 'sentry/types/organization';
import {descopeFeatureName} from 'sentry/utils';

import {withSubscription} from 'getsentry/components/withSubscription';
import {UNLIMITED_RESERVED} from 'getsentry/constants';
import {useBillingConfig} from 'getsentry/hooks/useBillingConfig';
import type {Plan, Subscription} from 'getsentry/types';
import {isBizPlanFamily, isDeveloperPlan} from 'getsentry/utils/billing';

type RenderProps = {
  /**
   * The plan that the user must upgrade to to use this feature.
   *
   * Null if there is no matching plan for the feature set. This can happen if
   * for example the features are only available on plans that are not
   * user-selectable or if the users current plan is on a special tier.
   */
  plan: Plan | null;
};

type Props = {
  children: (opts: RenderProps) => React.ReactNode;
  features: string[];
  organization: Organization;
  subscription: Subscription;
};

/**
 * Plan feature determines which plan a user must be on in order to access a
 * particular set of features.
 */
function PlanFeature({subscription, features, organization, children}: Props) {
  const {data: billingConfig} = useBillingConfig({organization});

  if (!billingConfig) {
    return null;
  }

  const {billingInterval} = subscription;

  const billingIntervalFilter = (p: Plan) => p.billingInterval === billingInterval;

  let plans = billingConfig.planList
    .filter(
      p =>
        p.userSelectable &&
        !isDeveloperPlan(p) &&
        // Only recommend business plans if the subscription is sponsored
        (subscription.isSponsored ? isBizPlanFamily(p) : true)
    )
    .sort((a, b) => a.totalPrice - b.totalPrice);

  // We try and keep the list of plans as close to the user current plan
  // configuration as we can by matching on the billing interval, but fall
  // back to the full list when that produces an empty set.
  function matchPlanConfiguration() {
    const filtered = plans.filter(billingIntervalFilter);
    if (filtered.length > 0) {
      return filtered;
    }

    return plans;
  }

  plans = matchPlanConfiguration();

  // Enterprise plans are *not* user selectable, so they're excluded from the
  // list above, but some features are only offered on them (e.g.
  // spend-allocations). Include them so those features can still resolve to an
  // upgrade target.
  const enterprisePlans = billingConfig.planList
    .filter(billingIntervalFilter)
    .filter(p => p.isEnterprise);

  plans.push(...enterprisePlans);

  // If we're dealing with plans that are *not part of a tier* Then we can
  // assume special case that there is only one plan.
  if (billingConfig.id === null && plans.length === 0) {
    plans = billingConfig.planList;
  }

  // Locate the first plan that offers these features
  let requiredPlan = plans.find(plan =>
    features.map(descopeFeatureName).every(f => plan.features.includes(f))
  );

  if (!requiredPlan && features.some(f => descopeFeatureName(f) === 'dashboards-edit')) {
    // XXX(isabella): This is a temporary fix to allow upsells using dashboards-edit
    // to work as expected before the feature was migrated to flagpole (to represent unlimited dashboards)
    requiredPlan = plans.find(plan => plan.dashboardLimit === UNLIMITED_RESERVED);
  }

  return <Fragment>{children({plan: requiredPlan ?? null})}</Fragment>;
}

export default withSubscription(PlanFeature, {noLoader: true});
