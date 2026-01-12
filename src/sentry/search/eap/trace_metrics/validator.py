from datetime import datetime, timedelta, timezone

from rest_framework import serializers

from sentry.exceptions import InvalidSearchQuery
from sentry.search.eap.resolver import SearchResolver
from sentry.search.eap.trace_metrics.config import TraceMetricsSearchResolverConfig
from sentry.search.eap.trace_metrics.definitions import TRACE_METRICS_DEFINITIONS
from sentry.search.eap.trace_metrics.types import TraceMetric
from sentry.search.events.types import SnubaParams


def extract_trace_metric_from_aggregate(aggregate: str) -> TraceMetric | None:
    """
    Extract trace metric information from an aggregate string using SearchResolver.

    Args:
        aggregate: The aggregate function string

    Returns:
        TraceMetric | None: The extracted trace metric or None if no specific metric

    Raises:
        InvalidSearchQuery: If the aggregate is invalid
    """

    now = datetime.now(tz=timezone.utc)
    snuba_params = SnubaParams(
        projects=[],
        organization=None,
        start=now - timedelta(hours=1),
        end=now,
    )

    resolver = SearchResolver(
        params=snuba_params,
        config=TraceMetricsSearchResolverConfig(metric=None),
        definitions=TRACE_METRICS_DEFINITIONS,
    )

    resolved_function, _ = resolver.resolve_function(aggregate)

    return resolved_function.trace_metric


def validate_trace_metrics_aggregate(aggregate: str) -> None:
    """
    Validate a trace metrics aggregate using the SearchResolver.

    Args:
        aggregate: The aggregate function to validate

    Raises:
        serializers.ValidationError: If the aggregate is invalid
        InvalidSearchQuery: If the aggregate is invalid
    """
    try:
        trace_metric = extract_trace_metric_from_aggregate(aggregate)
        if trace_metric is None:
            raise InvalidSearchQuery(
                f"Trace metrics aggregate {aggregate} must specify metric name, type, and unit"
            )

    except InvalidSearchQuery as e:
        raise serializers.ValidationError({"aggregate": f"Invalid trace metrics aggregate: {e}"})
