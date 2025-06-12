import moment from 'moment-timezone';

import type {RecurringCredit as TRecurringCredit} from 'getsentry/types';
import {CreditType} from 'getsentry/types';

export function RecurringCreditFixture(params?: TRecurringCredit): TRecurringCredit {
  return {
    id: 1,
    periodStart: moment().format(),
    periodEnd: moment().utc().add(3, 'months').format(),
    amount: 50000,
    type: CreditType.ERROR,
    totalAmountRemaining: null,
    ...params,
  };
}
