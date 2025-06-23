import {PlanFixture} from 'getsentry/__fixtures__/plan';
import {MONTHLY} from 'getsentry/constants';
import type {Subscription} from 'getsentry/types';

export function PendingChangesFixture(
  fields: Partial<Subscription['pendingChanges']>
): Subscription['pendingChanges'] {
  return {
    customPrice: null,
    customPriceAttachments: null,
    customPriceErrors: null,
    customPricePcss: null,
    customPriceTransactions: null,
    // TODO(data categories): BIL-964
    customPrices: {},
    effectiveDate: '2021-02-01',
    onDemandBudgets: null,
    onDemandEffectiveDate: '2021-02-01',
    onDemandMaxSpend: 0,
    plan: 'am1_team',
    planDetails: PlanFixture({
      name: 'Team',
      contractInterval: MONTHLY,
    }),
    planName: 'Team',
    // TODO(data categories): BIL-964
    reserved: {},
    reservedAttachments: null,
    reservedErrors: null,
    reservedEvents: 0,
    reservedTransactions: null,
    reservedBudgets: [],
    reservedCpe: {},
    ...fields,
  };
}
