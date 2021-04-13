import {TraceFullDetailed} from 'app/utils/performance/quickTrace/types';

export type TraceInfo = {
  /**
   * The projects in the trace
   */
  projects: Set<string>;
  /**
   * The errors in the trace.
   */
  errors: Set<string>;
  /**
   * The transactions in the trace.
   */
  transactions: Set<string>;
  /**
   * The very earliest start timestamp in the trace.
   */
  startTimestamp: number;
  /**
   * The very latest end timestamp in the trace.
   */
  endTimestamp: number;
  /**
   * The maximum generation in the trace.
   */
  maxGeneration: number;
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
