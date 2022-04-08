import {TraceFullDetailed} from 'sentry/utils/performance/quickTrace/types';

export type TraceInfo = {
  /**
   * The very latest end timestamp in the trace.
   */
  endTimestamp: number;
  /**
   * The errors in the trace.
   */
  errors: Set<string>;
  /**
   * The maximum generation in the trace.
   */
  maxGeneration: number;
  /**
   * The projects in the trace
   */
  projects: Set<string>;
  /**
   * The very earliest start timestamp in the trace.
   */
  startTimestamp: number;
  /**
   * The transactions in the trace.
   */
  transactions: Set<string>;
};

export type TraceRoot = Pick<
  TraceFullDetailed,
  'generation' | 'transaction.duration' | 'children' | 'start_timestamp' | 'timestamp'
> & {
  traceSlug: string;
};

export type TreeDepth = {
  depth: number;
  isOrphanDepth: boolean;
};
