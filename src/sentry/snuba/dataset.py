from enum import Enum, unique


@unique
class Dataset(Enum):
    Events = "events"
    "The events dataset contains all ingested errors."

    Transactions = "transactions"
    "The transactions dataset contains all ingested transactions."

    Discover = "discover"
    "The discover dataset is a combination of both the events and transactions datasets."

    Outcomes = "outcomes"
    """
    The outcomes dataset contains materialized views of raw outcomes.
    Outcomes are used to track usage of the product, i.e. how many errors has the
    project ingested, etc.
    """

    OutcomesRaw = "outcomes_raw"
    "The raw, non materialized version of the above"

    Sessions = "sessions"
    "The sessions dataset is deprecated."

    Metrics = "metrics"
    "this 'metrics' dataset is only used for release health."

    PerformanceMetrics = "generic_metrics"
    """
    PerformanceMetrics contains all generic metrics platform metrics.
    """

    Replays = "replays"
    "Indexed data for the Session Replays feature"

    Profiles = "profiles"
    "Indexed data for the Profiling feature"

    IssuePlatform = "search_issues"
    "Issues made via the issue platform will be searchable via the IssuePlatform dataset"

    Functions = "functions"
    "The functions dataset is built on top of profiling and contains more granular data about profiling functions"

    SpansIndexed = "spans"
    """
    Contains span data which is searchable.
    This is different from metrics,
    indexed spans are similar to indexed transactions in the fields available to search
    """


@unique
class EntityKey(Enum):
    Events = "events"
    Sessions = "sessions"
    Spans = "spans"
    Transactions = "transactions"
    MetricsSets = "metrics_sets"
    MetricsCounters = "metrics_counters"
    OrgMetricsCounters = "org_metrics_counters"
    MetricsDistributions = "metrics_distributions"
    GenericMetricsDistributions = "generic_metrics_distributions"
    GenericMetricsSets = "generic_metrics_sets"
    GenericMetricsCounters = "generic_metrics_counters"
    GenericMetricsGauges = "generic_metrics_gauges"
    GenericOrgMetricsCounters = "generic_org_metrics_counters"
    IssuePlatform = "search_issues"
    Functions = "functions"
    MetricsSummaries = "metrics_summaries"
