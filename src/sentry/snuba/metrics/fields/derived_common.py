from collections.abc import Mapping

from sentry.snuba.metrics.fields.base import DerivedMetricExpression
from sentry.snuba.metrics.fields.derived import DERIVED_ALIASES, DERIVED_METRICS, DERIVED_OPS
from sentry.snuba.metrics.fields.derived_v2 import (
    DERIVED_ALIASES_V2,
    DERIVED_METRICS_V2,
    DERIVED_OPS_V2,
)

__all__ = ["get_derived_metrics", "get_derived_ops", "get_derived_aliases"]


def get_derived_metrics(
    use_metrics_v2: bool | None = None,
) -> Mapping[str, DerivedMetricExpression]:
    return DERIVED_METRICS_V2 if use_metrics_v2 else DERIVED_METRICS


def get_derived_ops(
    use_metrics_v2: bool | None = None,
) -> Mapping[str, DerivedMetricExpression]:
    return DERIVED_OPS_V2 if use_metrics_v2 else DERIVED_OPS


def get_derived_aliases(
    use_metrics_v2: bool | None = None,
) -> Mapping[str, DerivedMetricExpression]:
    return DERIVED_ALIASES_V2 if use_metrics_v2 else DERIVED_ALIASES
