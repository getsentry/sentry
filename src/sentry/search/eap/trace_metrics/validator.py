import logging
from datetime import datetime, timedelta, timezone

from rest_framework import serializers

from sentry.discover.arithmetic import is_equation, parse_arithmetic, strip_equation
from sentry.exceptions import InvalidSearchQuery
from sentry.search.eap.resolver import SearchResolver
from sentry.search.eap.trace_metrics.config import TraceMetricsSearchResolverConfig
from sentry.search.eap.trace_metrics.definitions import TRACE_METRICS_DEFINITIONS
from sentry.search.eap.trace_metrics.types import TraceMetric
from sentry.search.events.types import SnubaParams

logger = logging.getLogger(__name__)


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
        config=TraceMetricsSearchResolverConfig(
            metric=None
        ),  # It's fine to not pass a metric here since that way of using metrics is deprecated.
        definitions=TRACE_METRICS_DEFINITIONS,
    )

    resolved_function, _ = resolver.resolve_function(aggregate)

    return getattr(resolved_function, "trace_metric", None)


def validate_trace_metrics_aggregate(aggregate: str) -> None:
    """
    Validate a trace metrics aggregate using the SearchResolver.

    Args:
        aggregate: The aggregate function to validate

    Raises:
        serializers.ValidationError: If the aggregate is invalid
    """
    if is_equation(aggregate):
        _, _, terms = parse_arithmetic(strip_equation(aggregate))
    else:
        terms = [aggregate]

    for term in terms:
        try:
            trace_metric = extract_trace_metric_from_aggregate(term)
            if trace_metric is None:
                raise InvalidSearchQuery(
                    f"Trace metrics aggregate {term} must specify metric name, type, and unit"
                )
        except InvalidSearchQuery as e:
            logger.exception(f"Invalid trace metrics aggregate: {term} {e}")
            raise serializers.ValidationError(
                {"aggregate": f"Invalid trace metrics aggregate: {term}"}
            )
