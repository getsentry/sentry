from dataclasses import dataclass
from typing import Any

from sentry.discover.models import DiscoverSavedQueryTypes
from sentry.snuba import (
    discover,
    errors,
    functions,
    issue_platform,
    metrics_enhanced_performance,
    metrics_performance,
    profiles,
    spans_eap,
    spans_indexed,
    spans_metrics,
    transactions,
)
from sentry.snuba.models import QuerySubscription, SnubaQuery

# Doesn't map 1:1 with real datasets, but rather what we present to users
# ie. metricsEnhanced is not a real dataset
DATASET_OPTIONS = {
    "discover": discover,
    "errors": errors,
    "metricsEnhanced": metrics_enhanced_performance,
    "metrics": metrics_performance,
    "profiles": profiles,
    "issuePlatform": issue_platform,
    "profileFunctions": functions,
    "spans": spans_eap,
    "spansIndexed": spans_indexed,
    "spansMetrics": spans_metrics,
    "transactions": transactions,
}
DATASET_LABELS = {value: key for key, value in DATASET_OPTIONS.items()}


TRANSACTION_ONLY_FIELDS = [
    "transaction.duration",
    "transaction.op",
    "transaction.status",
    "measurements.lcp",
    "measurements.cls",
    "measurements.fcp",
    "measurements.fid",
    "measurements.inp",
    "measurements.ttfb.requesttime",
    "measurements.app_start_cold",
    "measurements.app_start_warm",
    "measurements.frames_total",
    "measurements.frames_slow",
    "measurements.frames_frozen",
    "measurements.frames_slow_rate",
    "measurements.frames_frozen_rate",
    "measurements.stall_count",
    "measurements.stall_total_time",
    "measurements.stall_longest_time",
    "measurements.stall_percentage",
    "measurements.time_to_full_display",
    "measurements.time_to_initial_display",
    "spans.browser",
    "spans.http",
    "spans.db",
    "spans.resource",
    "spans.ui",
]

ERROR_ONLY_FIELDS = [
    "location",
    "error.type",
    "error.value",
    "error.mechanism",
    "error.handled",
    "error.unhandled",
    "error.received",
    "error.main_thread",
    "level",
    "stack.abs_path",
    "stack.colno",
    "stack.filename",
    "stack.function",
    "stack.in_app",
    "stack.lineno",
    "stack.module",
    "stack.package",
    "stack.resource",
    "stack.stack_level",
]


def get_dataset(dataset_label: str) -> Any | None:
    return DATASET_OPTIONS.get(dataset_label)


@dataclass
class QueryStrings:
    query_string: str
    query_extra: str
    query: str


def build_query_strings(
    subscription: QuerySubscription | None, snuba_query: SnubaQuery
) -> QueryStrings:
    """
    Constructs a QueryStrings dataclass given a QuerySubscription and SnubaQuery.
    query_string value is derived from the snuba_query.query and the subscription.query_extra.

    TODO: determine whether this is necessary in all places where `snuba_query.query` is used.
    """
    query_extra = ""
    if subscription and subscription.query_extra:
        if snuba_query.query:
            query_extra = " and "
        query_extra += subscription.query_extra

    return QueryStrings(
        query=snuba_query.query,
        query_extra=query_extra,
        query_string=f"{snuba_query.query}{query_extra}",
    )


def dataset_split_decision_inferred_from_query(columns, query):
    """
    Infers split decision based on fields we know exclusively belong to one
    dataset or the other. Biases towards Errors dataset.
    """
    for field in ERROR_ONLY_FIELDS:
        if field in query:
            return DiscoverSavedQueryTypes.ERROR_EVENTS

    for field in TRANSACTION_ONLY_FIELDS:
        if field in query:
            return DiscoverSavedQueryTypes.TRANSACTION_LIKE

    for column in columns:
        for field in ERROR_ONLY_FIELDS:
            if field in column:
                return DiscoverSavedQueryTypes.ERROR_EVENTS

        for field in TRANSACTION_ONLY_FIELDS:
            if field in column:
                return DiscoverSavedQueryTypes.TRANSACTION_LIKE

    return None
