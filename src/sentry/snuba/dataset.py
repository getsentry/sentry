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
    IssuePlatform = "search_issues"
    Functions = "functions"
    SpansIndexed = "spans"


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
    GenericMetricsCounters = "generic_metrics_counters"
    GenericOrgMetricsCounters = "generic_org_metrics_counters"
    IssuePlatform = "search_issues"
    Profiles = "profiles"
