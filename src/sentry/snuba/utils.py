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
)

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
}
DATASET_LABELS = {value: key for key, value in DATASET_OPTIONS.items()}


def get_dataset(dataset_label: str) -> Any | None:
    return DATASET_OPTIONS.get(dataset_label)
