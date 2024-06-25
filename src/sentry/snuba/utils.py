from typing import Any

from sentry.snuba import (
    discover,
    errors,
    functions,
    issue_platform,
    metrics_enhanced_performance,
    metrics_performance,
    profiles,
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
    "spansIndexed": spans_indexed,
    "spansMetrics": spans_metrics,
    "transactions": transactions,
}
DATASET_LABELS = {value: key for key, value in DATASET_OPTIONS.items()}


def get_dataset(dataset_label: str) -> Any | None:
    return DATASET_OPTIONS.get(dataset_label)


def build_query_extra(subscription: QuerySubscription | None, snuba_query: SnubaQuery) -> str:
    query_extra = ""
    if subscription and subscription.query_extra:
        if snuba_query.query:
            query_extra = " and "
        query_extra += subscription.query_extra

    return query_extra
