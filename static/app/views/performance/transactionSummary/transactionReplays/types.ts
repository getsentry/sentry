import type {ReplayListRecord} from 'sentry/views/explore/replays/types';

export type EventSpanData = {
  'count()': number;
  replayId: string;
  'span_ops_breakdown.relative': string;
  'spans.browser': null | number;
  'spans.db': null | number;
  'spans.http': null | number;
  'spans.resource': null | number;
  'spans.ui': null | number;
  timestamp: string;
  trace: string;
  'transaction.duration': number;
};

export type ReplayListRecordWithTx = ReplayListRecord & {
  txEvent: Record<string, any>;
};
