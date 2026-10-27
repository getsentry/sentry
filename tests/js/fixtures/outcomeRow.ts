import type {OutcomeRow} from 'sentry/components/droppedData/types';

export function OutcomeRowFixture(params: Partial<OutcomeRow> = {}): OutcomeRow {
  return {
    type: 'system',
    category: 'span',
    reason: 'rate_limited',
    outcome: 'rate_limited',
    start: 0,
    end: 60_000,
    count: 1,
    tags: ['unintentional'],
    ...params,
  };
}
