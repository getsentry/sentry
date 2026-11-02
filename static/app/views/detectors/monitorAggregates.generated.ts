/**
 * GENERATED FILE. Do not edit manually.
 * To update it run `python3 -m tools.monitor_aggregates_to_typescript`
 *
 * The functions that metric monitors accept for each EAP dataset, from
 * EAP_MONITOR_FUNCTIONS in metric_data_source_schema.py.
 *
 * DEPLOYMENT: This is safe to deploy alongside backend changes.
 */

export const MONITOR_AGGREGATES = {
  spans: [
    'count',
    'count_unique',
    'avg',
    'p50',
    'p75',
    'p90',
    'p95',
    'p99',
    'p100',
    'max',
    'min',
    'sum',
    'epm',
    'failure_count',
    'failure_rate',
    'eps',
    'apdex',
    'user_misery',
    'performance_score',
    'opportunity_score',
  ],
  logs: [
    'count',
    'count_unique',
    'avg',
    'p50',
    'p75',
    'p90',
    'p95',
    'p99',
    'max',
    'min',
    'sum',
  ],
} as const;
