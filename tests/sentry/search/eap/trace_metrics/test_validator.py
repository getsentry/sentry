import pytest
from rest_framework import serializers

from sentry.search.eap.trace_metrics.types import TraceMetric
from sentry.search.eap.trace_metrics.validator import (
    extract_trace_metric_from_aggregate,
    extract_trace_metrics_from_aggregate,
    validate_trace_metrics_aggregate,
)
from sentry.search.eap.trace_metrics.web_vitals import WEB_VITAL_SCORE_METRICS


def test_extract_trace_metrics_from_metric_aggregate() -> None:
    aggregate = "p75(value,browser.web_vital.lcp,distribution,millisecond)"
    metric = TraceMetric(
        metric_name="browser.web_vital.lcp", metric_type="distribution", metric_unit="millisecond"
    )
    assert extract_trace_metric_from_aggregate(aggregate) == metric
    assert extract_trace_metrics_from_aggregate(aggregate) == frozenset([metric])


def test_extract_trace_metrics_from_web_vital_formula() -> None:
    aggregate = "performance_score(measurements.score.total)"
    assert extract_trace_metric_from_aggregate(aggregate) is None
    assert extract_trace_metrics_from_aggregate(aggregate) == frozenset(
        WEB_VITAL_SCORE_METRICS.values()
    )


@pytest.mark.parametrize(
    "aggregate",
    [
        "performance_score(measurements.score.total)",
        "opportunity_score(measurements.score.total)",
        "p75(value,browser.web_vital.lcp,distribution,millisecond)",
    ],
)
def test_validate_trace_metrics_aggregate_accepts(aggregate: str) -> None:
    validate_trace_metrics_aggregate(aggregate)


@pytest.mark.parametrize(
    "aggregate",
    [
        # Single vitals are plain aggregates over the score metric, not formulas
        "performance_score(measurements.score.lcp)",
        "count_scores(measurements.score.lcp)",
        "performance_score(value)",
        "sum(value)",
    ],
)
def test_validate_trace_metrics_aggregate_rejects(aggregate: str) -> None:
    with pytest.raises(serializers.ValidationError):
        validate_trace_metrics_aggregate(aggregate)
