import AM1_PLANS from 'getsentry-test/fixtures/am1Plans';
import AM2_PLANS from 'getsentry-test/fixtures/am2Plans';
import AM3_PLANS from 'getsentry-test/fixtures/am3Plans';
import {FeatureListFixture} from 'getsentry-test/fixtures/featureList';
import MM1_PLANS from 'getsentry-test/fixtures/mm1Plans';
import MM2_PLANS from 'getsentry-test/fixtures/mm2Plans';

import type {BillingConfig} from 'getsentry/types';
import {PlanTier} from 'getsentry/types';

export function BillingConfigFixture(tier: PlanTier): BillingConfig {
  if (tier === PlanTier.MM1) {
    return {
      id: PlanTier.MM1,
      freePlan: 'f1',
      defaultPlan: 'm1',
      defaultReserved: {errors: 1000000},
      annualDiscount: 0.1,
      planList: Object.values(MM1_PLANS),
      featureList: FeatureListFixture(),
    };
  }

  if (tier === PlanTier.MM2) {
    return {
      id: PlanTier.MM2,
      freePlan: 'mm2_f',
      defaultPlan: 'mm2_a_100k',
      defaultReserved: {errors: 100000},
      annualDiscount: 0.1,
      planList: Object.values(MM2_PLANS),
      featureList: FeatureListFixture(),
    };
  }

  if (tier === PlanTier.AM2) {
    return {
      id: PlanTier.AM2,
      freePlan: 'am2_f',
      defaultPlan: 'am2_team',
      defaultReserved: {
        errors: 50000,
        transactions: 100000,
        attachments: 1,
        replays: 500,
        monitorSeats: 1,
        uptime: 1,
      },
      annualDiscount: 0.1,
      planList: Object.values(AM2_PLANS),
      featureList: FeatureListFixture(),
    };
  }

  if (tier === PlanTier.AM3) {
    return {
      id: PlanTier.AM3,
      freePlan: 'am3_f',
      defaultPlan: 'am3_team',
      defaultReserved: {
        errors: 50_000,
        attachments: 1,
        replays: 50,
        monitorSeats: 1,
        spans: 10_000_000,
        uptime: 1,
      },
      annualDiscount: 0.1,
      planList: Object.values(AM3_PLANS),
      featureList: FeatureListFixture(),
    };
  }

  return {
    id: PlanTier.AM1,
    freePlan: 'am1_f',
    defaultPlan: 'am1_team',
    defaultReserved: {
      errors: 50000,
      transactions: 100000,
      attachments: 1,
      replays: 500,
      monitorSeats: 1,
      uptime: 1,
    },
    annualDiscount: 0.1,
    planList: Object.values(AM1_PLANS),
    featureList: FeatureListFixture(),
  };
}
