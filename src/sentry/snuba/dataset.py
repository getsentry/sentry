from enum import Enum, unique


@unique
class Dataset(Enum):
    Events = "events"
    Transactions = "transactions"
    Discover = "discover"
    Outcomes = "outcomes"
    OutcomesRaw = "outcomes_raw"
    Sessions = "sessions"
    # Actually Release Health
    Metrics = "metrics"
    PerformanceMetrics = "generic_metrics"
    Replays = "replays"
    Profiles = "profiles"


@unique
class EntityKey(Enum):
    Events = "events"
    Sessions = "sessions"
    Transactions = "transactions"
    MetricsSets = "metrics_sets"
    MetricsCounters = "metrics_counters"
    OrgMetricsCounters = "org_metrics_counters"
    MetricsDistributions = "metrics_distributions"
    GenericMetricsDistributions = "generic_metrics_distributions"
    GenericMetricsSets = "generic_metrics_sets"
