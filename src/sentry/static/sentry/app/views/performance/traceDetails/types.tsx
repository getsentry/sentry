export type TraceInfo = {
  /**
   * The number of projects in the trace with an error that matched the user condition.
   */
  relevantProjectsWithErrors: number;
  /**
   * The number of projects in the trace wth a transaction that matched the user condition.
   */
  relevantProjectsWithTransactions: number;
  /**
   * The total number errors in the trace.
   */
  totalErrors: number;
  /**
   * The number of errors in the trace that matched the user condition.
   */
  relevantErrors: number;
  /**
   * The total number transactions in the trace.
   */
  totalTransactions: number;
  /**
   * The number of transactions in the trace that matched the user condition.
   */
  relevantTransactions: number;
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
