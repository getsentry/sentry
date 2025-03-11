import cloneDeep from 'lodash/cloneDeep';

import AM1_PLANS from 'getsentry-test/fixtures/am1Plans';
import AM2_PLANS from 'getsentry-test/fixtures/am2Plans';
import AM3_PLANS from 'getsentry-test/fixtures/am3Plans';
import MM1_PLANS from 'getsentry-test/fixtures/mm1Plans';
import MM2_PLANS from 'getsentry-test/fixtures/mm2Plans';

import {PlanTier} from 'getsentry/types';

type PlanIds = keyof typeof AM1_PLANS &
  keyof typeof AM2_PLANS &
  keyof typeof AM3_PLANS &
  keyof typeof MM1_PLANS &
  keyof typeof MM2_PLANS;

// Pass a planId to get back details for that particular plan, or 'all'
// to get a list of all plan detail objects for a plan tier.
export function PlanDetailsLookupFixture(planId: PlanIds, tier?: PlanTier) {
  if (!planId) {
    throw new Error('Must provide a planId or `all`');
  }

  const planData =
    tier ?? planId.startsWith(PlanTier.AM3)
      ? AM3_PLANS[planId]
      : planId.startsWith(PlanTier.AM1)
        ? AM1_PLANS[planId]
        : planId.startsWith(PlanTier.AM2)
          ? AM2_PLANS[planId]
          : planId.startsWith(PlanTier.MM2)
            ? MM2_PLANS[planId]
            : MM1_PLANS[planId];

  return cloneDeep(planData);
}
