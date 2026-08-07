import {Fragment} from 'react';

import type {Organization} from 'sentry/types/organization';
import {descopeFeatureName} from 'sentry/utils';

import {withSubscription} from 'getsentry/components/withSubscription';
import {UNLIMITED_RESERVED} from 'getsentry/constants';
import {useBillingConfig} from 'getsentry/hooks/useBillingConfig';
import type {Plan, Subscription} from 'getsentry/types';
import {
  isBizPlanFamily,
  isDeveloperPlan,
  isTeamPlanFamily,
} from 'getsentry/utils/billing';

/**
 * Plan tiers ordered from least to most capable. A plan satisfies a feature's
 * requirement when its own rank is at or above the feature's minimum.
 */
const ORDERED_PLAN_TYPES = ['team', 'business', 'enterprise'] as const;

type PlanType = (typeof ORDERED_PLAN_TYPES)[number];

/**
 * The lowest plan tier that includes each upsellable feature.
 *
 * Feature *gating* is owned by Flagpole; this map exists only to answer "which
 * plan must a customer buy to get this?" so an upsell can name a plan. Keys are
 * descoped feature names, so both `organizations:foo` and `foo` resolve here.
 *
 * A feature absent from this map has no upgrade target and its upsell renders
 * without a plan name, so add an entry when wiring up a new `feature-disabled:*`
 * override.
 */
const UPSELL_MINIMUM_PLAN_TYPE: Record<string, PlanType> = {
  'custom-inbound-filters': 'business',
  'custom-symbol-sources': 'business',
  'data-forwarding': 'business',
  'discard-groups': 'business',
  'discover-basic': 'team',
  'discover-query': 'team',
  'extended-data-retention': 'team',
  incidents: 'team',
  'integrations-scm-multi-org': 'business',
  'integrations-ticket-rules': 'business',
  'issue-views': 'team',
  'performance-view': 'team',
  'rate-limits': 'business',
  'spend-allocations': 'enterprise',
  'sso-basic': 'team',
  'sso-saml2': 'business',
  'team-roles': 'business',
};

function planType(plan: Plan): PlanType | null {
  if (plan.isEnterprise) {
    return 'enterprise';
  }
  if (isBizPlanFamily(plan)) {
    return 'business';
  }
  if (isTeamPlanFamily(plan)) {
    return 'team';
  }
  return null;
}

/**
 * Whether `plan` is capable enough for every requested feature.
 */
function planSatisfies(plan: Plan, requestedFeatures: string[]) {
  const type = planType(plan);
  if (type === null) {
    return false;
  }

  const rank = ORDERED_PLAN_TYPES.indexOf(type);

  return requestedFeatures.map(descopeFeatureName).every(feature => {
    const required = UPSELL_MINIMUM_PLAN_TYPE[feature];
    return required !== undefined && rank >= ORDERED_PLAN_TYPES.indexOf(required);
  });
}

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
  let requiredPlan = plans.find(plan => planSatisfies(plan, features));

  if (!requiredPlan && features.some(f => descopeFeatureName(f) === 'dashboards-edit')) {
    // XXX(isabella): This is a temporary fix to allow upsells using dashboards-edit
    // to work as expected before the feature was migrated to flagpole (to represent unlimited dashboards)
    requiredPlan = plans.find(plan => plan.dashboardLimit === UNLIMITED_RESERVED);
  }

  return <Fragment>{children({plan: requiredPlan ?? null})}</Fragment>;
}

export default withSubscription(PlanFeature, {noLoader: true});
