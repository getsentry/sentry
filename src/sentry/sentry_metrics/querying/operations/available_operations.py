from sentry.sentry_metrics.querying.operations.operation import MetricOp
from sentry.snuba.dataset import EntityKey

OP_COUNTERS_SUM = MetricOp(EntityKey.GenericMetricsCounters, "sum", "sumIf", "general", 0)
OP_COUNTERS_MIN_TIMESTAMP = MetricOp(
    EntityKey.GenericMetricsCounters, "min_timestamp", "minIf", "timestamp"
)
OP_COUNTERS_MAX_TIMESTAMP = MetricOp(
    EntityKey.GenericMetricsCounters, "max_timestamp", "maxIf", "timestamp"
)
OP_DISTRIBUTIONS_AVG = MetricOp(EntityKey.GenericMetricsDistributions, "avg", "avgIf", "general")
OP_DISTRIBUTIONS_COUNT = MetricOp(
    EntityKey.GenericMetricsDistributions, "count", "countIf", "general"
)
OP_DISTRIBUTIONS_MAX = MetricOp(EntityKey.GenericMetricsDistributions, "max", "maxIf", "general")
OP_DISTRIBUTIONS_MIN = MetricOp(EntityKey.GenericMetricsDistributions, "min", "minIf", "general")
OP_DISTRIBUTIONS_HISTOGRAM = MetricOp(
    EntityKey.GenericMetricsDistributions, "histogram", "histogramIf(250)", "general"
)
OP_DISTRIBUTIONS_SUM = MetricOp(EntityKey.GenericMetricsDistributions, "sum", "sumIf", "general")
OP_DISTRIBUTIONS_MIN_TIMESTAMP = MetricOp(
    EntityKey.GenericMetricsDistributions, "min_timestamp", "minIf", "timestamp"
)
OP_DISTRIBUTIONS_MAX_TIMESTAMP = MetricOp(
    EntityKey.GenericMetricsDistributions, "max_timestamp", "maxIf", "timestamp"
)
OP_SETS_COUNT_UNIQUE = MetricOp(EntityKey.GenericMetricsSets, "count_unique", "uniqIf", "general")
OP_SETS_MIN_TIMESTAMP = MetricOp(
    EntityKey.GenericMetricsSets, "min_timestamp", "minIf", "timestamp"
)
OP_SETS_MAX_TIMESTAMP = MetricOp(
    EntityKey.GenericMetricsSets, "max_timestamp", "maxIf", "timestamp"
)
OP_GAUGES_MIN = MetricOp(EntityKey.GenericMetricsGauges, "min", "minIf", "general")
OP_GAUGES_MAX = MetricOp(EntityKey.GenericMetricsGauges, "max", "maxIf", "general")
OP_GAUGES_SUM = MetricOp(EntityKey.GenericMetricsGauges, "sum", "sumIf", "general")
OP_GAUGES_COUNT = MetricOp(EntityKey.GenericMetricsGauges, "count", "countIf", "general")
OP_GAUGES_LAST = MetricOp(EntityKey.GenericMetricsGauges, "last", "lastIf", "general")
OP_GAUGES_AVG = MetricOp(EntityKey.GenericMetricsGauges, "avg", "avg", "general")
OP_DISTRIBUTIONS_P50 = MetricOp(
    EntityKey.GenericMetricsDistributions, "p50", "quantilesIf(0.50)", "percentile"
)
OP_DISTRIBUTIONS_P75 = MetricOp(
    EntityKey.GenericMetricsDistributions, "p75", "quantilesIf(0.75)", "percentile"
)
OP_DISTRIBUTIONS_P90 = MetricOp(
    EntityKey.GenericMetricsDistributions, "p90", "quantilesIf(0.90)", "percentile"
)
OP_DISTRIBUTIONS_P95 = MetricOp(
    EntityKey.GenericMetricsDistributions, "p95", "quantilesIf(0.95)", "percentile"
)
OP_DISTRIBUTIONS_P99 = MetricOp(
    EntityKey.GenericMetricsDistributions, "p99", "quantilesIf(0.99)", "percentile"
)
OP_DISTRIBUTIONS_P100 = MetricOp(
    EntityKey.GenericMetricsDistributions, "p100", "quantilesIf(01.100)", "percentile"
)
