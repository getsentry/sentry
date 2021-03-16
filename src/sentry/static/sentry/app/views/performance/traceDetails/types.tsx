export type TraceInfo = {
  /**
   * The total number projects in the trace.
   */
  totalProjects: number;
  /**
   * The number of projects in the trace that matched the user condition.
   */
  relevantProjects: number;
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
   *
   */
  maxGeneration: number;
};
