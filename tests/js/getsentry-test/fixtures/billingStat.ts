import type {BillingStat} from 'getsentry/types';

export function BillingStatFixture(params: Partial<BillingStat> = {}): BillingStat {
  return {
    date: '2021-01-01',
    ts: '',
    accepted: 0,
    dropped: {total: 0},
    filtered: 0,
    total: 0,
    ...params,
  };
}
