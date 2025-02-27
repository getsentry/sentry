import type {CustomerUsage as CustomerUsageType} from 'getsentry/types';

import {UsageTotalFixture} from './usageTotal';

export function CustomerUsageFixture(
  params: Partial<CustomerUsageType> = {}
): CustomerUsageType {
  return {
    periodStart: '2022-06-01',
    periodEnd: '2022-06-30',
    onDemandMaxSpend: 0,
    onDemandEventsAllowed: 0,
    totals: {
      errors: UsageTotalFixture(),
      transactions: UsageTotalFixture(),
      attachments: UsageTotalFixture(),
    },
    stats: {
      errors: [],
      transactions: [],
      attachments: [],
    },
    ...params,
  };
}
