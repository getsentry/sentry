import type {BillingStatTotal} from 'getsentry/types';

export function UsageTotalFixture(
  props: Partial<BillingStatTotal> = {}
): BillingStatTotal {
  return {
    accepted: 0,
    projected: 0,
    filtered: 0,
    dropped: 0,
    droppedOverQuota: 0,
    droppedSpikeProtection: 0,
    droppedOther: 0,
    ...props,
  };
}
