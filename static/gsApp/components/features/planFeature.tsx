import {Fragment} from 'react';

import type {Organization} from 'sentry/types/organization';
import {descopeFeatureName} from 'sentry/utils';

import withSubscription from 'getsentry/components/withSubscription';
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
  /**
   * If the feature requires changing plan tiers, this will report the required
   * plan tier that is DIFFERENT from the users current subscription tier.
   */
  tierChange: string | null;
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
  const {data: billingConfig} = useBillingConfig({organization, subscription});

  if (!billingConfig) {
    return null;
  }

  const {billingInterval, contractInterval} = subscription;

  const billingIntervalFilter = (p: Plan) => p.billingInterval === billingInterval;

  // Plans may not have a contract interval.
  const contractIntervalFilter = (p: Plan) =>
    contractInterval === undefined || p.contractInterval === contractInterval;

  let plans = billingConfig.planList
    .filter(
      p =>
        p.userSelectable &&
        !isDeveloperPlan(p) &&
        // Only recommend business plans if the subscription is sponsored
        (subscription.isSponsored ? isBizPlanFamily(p) : true)
    )
    .sort((a, b) => a.price - b.price);

  // We try and keep the list of plans as close to the user current plan
  // configuration as we can, however some older plans (mm2) have
  // configurations not present in newer billing plans.
  //
  // As an example, am1 does NOT have plans where the contract interval is
  // different from the billing interval.
  //
  // Because of this we incrementally loosen the filters when we produce an
  // empty set of plans.
  function matchPlanConfiguration() {
    let filtered: Plan[] = [];

    filtered = plans.filter(billingIntervalFilter).filter(contractIntervalFilter);
    if (filtered.length > 0) {
      return filtered;
    }

    filtered = plans.filter(billingIntervalFilter);
    if (filtered.length > 0) {
      return filtered;
    }

    return plans;
  }

  plans = matchPlanConfiguration();

  // XXX: Enterprise plans are *not* user selectable, but should be included
  // in the list of plans. Unfortunately we don't distinguish between Trial /
  // Friends & Family / Enterprise, so we hardcode the name here.
  //
  // XXX(epurkhiser): We don't really have enterprise plans anymore, so maybe
  // we no longer need this.
  const enterprisePlans = billingConfig.planList
    .filter(billingIntervalFilter)
    .filter(p => p.id.includes('ent'));

  plans.push(...enterprisePlans);

  // If we're dealing with plans that are *not part of a tier* Then we can
  // assume special case that there is only one plan.
  if (billingConfig.id === null && plans.length === 0) {
    plans = billingConfig.planList;
  }

  // Locate the first plan that offers these features
  const requiredPlan = plans.find(plan =>
    features.map(descopeFeatureName).every(f => plan.features.includes(f))
  );

  const tierChange =
    requiredPlan !== undefined && subscription.planTier !== billingConfig.id
      ? billingConfig.id
      : null;

  return <Fragment>{children({plan: requiredPlan ?? null, tierChange})}</Fragment>;
}

export default withSubscription(PlanFeature, {noLoader: true});
