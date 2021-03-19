export type TraceInfo = {
  /**
   * The projects in the trace with an error that matched the user condition.
   */
  relevantProjectsWithErrors: Set<string>;
  /**
   * The projects in the trace wth a transaction that matched the user condition.
   */
  relevantProjectsWithTransactions: Set<string>;
  /**
   * The errors in the trace that matched the user conditions.
   */
  relevantErrors: Set<string>;
  /**
   * The transactions in the trace that matched the user conditions.
   */
  relevantTransactions: Set<string>;
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
