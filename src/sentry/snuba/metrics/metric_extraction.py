import hashlib
import logging
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Dict, Literal, Optional, Sequence, Tuple, TypedDict, Union, cast

from snuba_sdk import BooleanCondition, Column, Condition
from typing_extensions import NotRequired

from sentry.constants import DataCategory
from sentry.snuba.dataset import Dataset
from sentry.snuba.metrics.utils import MetricOperationType
from sentry.snuba.models import SnubaQuery

logger = logging.getLogger(__name__)

# Name component of MRIs used for custom alert metrics.
# TODO: Move to a common module.
CUSTOM_ALERT_METRIC_NAME = "transactions/on_demand"
QUERY_HASH_KEY = "query_hash"

# Base type for conditions to evaluate on payloads.
# TODO: Streamline with dynamic sampling.
RuleCondition = Union["LogicalRuleCondition", "ComparingRuleCondition", "NotRuleCondition"]

_SNUBA_TO_RELAY_FIELDS = {
    # "browser.name": "event.browser.name",  # TODO is a function
    "contexts[geo.country_code]": "event.geo.country_code",
    "http_method": "event.http.method",
    # "http.status_code": "event.http.status_code",  TODO is a function
    # "os.name": "event.os.name",  TODO is a function
    "release": "event.release",
    "transaction_op": "event.transaction.op",
    "transaction_status": "event.transaction.status",
    "duration": "event.duration",
    "measurements[cls]": "event.measurements.cls",
    "measurements[fcp]": "event.measurements.fcp",
    "measurements[fid]": "event.measurements.fid",
    "measurements[fp]": "event.measurements.fp",
    "measurements[lcp]": "event.measurements.lcp",
    "measurements[ttfb]": "event.measurements.ttfb",
    "measurements[ttfb.requesttime]": "event.measurements.ttfb.requesttime",
}

_SNUBA_TO_METRIC_AGGREGATES: Dict[str, Optional[MetricOperationType]] = {
    "count": "sum",
    "avg": "avg",
    "quantile(0.50)": "p50",
    "quantile(0.75)": "p75",
    "quantile(0.95)": "p95",
    "quantile(0.99)": "p99",
    "max": "max",
    # not supported yet
    "percentile": None,
    "failure_rate": None,
    "apdex": None,
}

# TODO: support count_if
_AGGREGATE_TO_METRIC_TYPE = {
    "count": "c",
    "avg": "d",
    "quantile(0.50)": "d",
    "quantile(0.75)": "d",
    "quantile(0.95)": "d",
    "quantile(0.99)": "d",
    "max": "d",
    # not supported yet
    "percentile": None,
    "failure_rate": None,
    "apdex": None,
}


class ComparingRuleCondition(TypedDict):
    """RuleCondition that compares a named field to a reference value."""

    op: Literal["eq", "gt", "gte", "lt", "lte", "glob"]
    name: str
    value: Any


class LogicalRuleCondition(TypedDict):
    """RuleCondition that applies a logical operator to a sequence of conditions."""

    op: Literal["and", "or"]
    inner: Sequence[RuleCondition]


class NotRuleCondition(TypedDict):
    """RuleCondition that negates an inner condition."""

    op: Literal["not"]
    inner: RuleCondition


class TagSpec(TypedDict):
    """
    Configuration for a tag to add to a metric.

    Tags values can be static if defined through `value` or dynamically queried
    from the payload if defined through `field`. These two options are mutually
    exclusive, behavior is undefined if both are specified.
    """

    key: str
    field: NotRequired[str]
    value: NotRequired[str]
    condition: NotRequired[RuleCondition]


class MetricSpec(TypedDict):
    """
    Specification for a metric to extract from some data.

    The metric type is given as part of the MRI (metric reference identifier)
    which must follow the form: `<type>:<namespace>/<name>@<unit>`.

    How the metric's value is obtained depends on the metric type:
     - Counter metrics are a special case, since the default product counters do
       not count any specific field but rather the occurrence of the event. As
       such, there is no value expression, and the field is set to `None`.
       Semantics of specifying remain undefined at this point.
     - Distribution metrics require a numeric value.
     - Set metrics require a string value, which is then emitted into the set as
       unique value. Insertion of numbers and other types is undefined.
    """

    category: Literal["transaction"]
    mri: str
    field: NotRequired[Optional[str]]
    condition: NotRequired[RuleCondition]
    tags: NotRequired[Sequence[TagSpec]]


def convert_alert_to_metric(snuba_query: SnubaQuery) -> Optional[MetricSpec]:
    if snuba_query.dataset != Dataset.PerformanceMetrics.value:
        return None

    try:
        spec = OndemandMetricSpec.parse(snuba_query.aggregate, snuba_query.query)
        if not spec:
            return None

        return {
            "category": DataCategory.TRANSACTION.api_name(),
            "mri": spec.mri,
            "field": spec.field,
            "condition": spec.condition(),
            "tags": [{"key": QUERY_HASH_KEY, "value": spec.query_hash()}],
        }
    except Exception as e:
        logger.error(e, exc_info=True)
        return None


@dataclass(frozen=True)
class OndemandMetricSpec:
    _field: str
    _query: str

    field: Optional[str]
    metric_type: str
    mri: str
    op: MetricOperationType

    @classmethod
    def check(cls, field: str, query: str) -> bool:
        """Returns ``True`` if a metrics query requires an on-demand metric."""
        # TODO?: self.dataset == Dataset.PerformanceMetrics.value and
        return "transaction.duration" in query

    @classmethod
    def parse(cls, field: str, query: str) -> Optional["OndemandMetricSpec"]:
        if not cls.check(field, query):
            return None

        relay_field, metric_type, op = _extract_field_info(field)

        return cls(
            _field=field,
            _query=query,
            field=relay_field,
            metric_type=metric_type,
            mri=f"{metric_type}:{CUSTOM_ALERT_METRIC_NAME}@none",
            op=op,
        )

    def query_hash(self) -> str:
        str_to_hash = f"{self.field};{self._query}"
        return hashlib.shake_128(bytes(str_to_hash, encoding="ascii")).hexdigest(4)

    def condition(self) -> RuleCondition:
        where, having = _get_query_builder().resolve_conditions(self._query, False)

        assert where, "Query should not use on demand metrics"
        assert not having, "Having conditions are not supported"

        where = [c for c in (_convert_condition(c) for c in where) if c is not None]

        if len(where) == 1:
            return where[0]
        else:
            return {"op": "and", "inner": where}


def _extract_field_info(aggregate: str) -> Tuple[Optional[str], str, MetricOperationType]:
    select = _get_query_builder().resolve_column(aggregate, False)

    metric_type = _AGGREGATE_TO_METRIC_TYPE.get(select.function)
    metric_op = _SNUBA_TO_METRIC_AGGREGATES.get(select.function)
    assert metric_type and metric_op, f"Unsupported aggregate function {select.function}"

    if metric_type == "c":
        assert not select.parameters, "Count should not have parameters"
        return None, metric_type, metric_op
    else:
        assert len(select.parameters) == 1, "Only one parameter is supported"

        name = select.parameters[0].name
        assert name in _SNUBA_TO_RELAY_FIELDS, f"Unsupported field {name}"

        return _SNUBA_TO_RELAY_FIELDS[name], metric_type, metric_op


def _convert_condition(condition: Union[Condition, BooleanCondition]) -> Optional[RuleCondition]:
    if isinstance(condition, BooleanCondition):
        return cast(
            RuleCondition,
            {
                "op": condition.op.name.lower(),
                "inner": [_convert_condition(c) for c in condition.conditions],
            },
        )

    assert isinstance(condition, Condition), f"Unsupported condition type {type(condition)}"

    # TODO: Currently we do not support function conditions like count_if
    if not isinstance(condition.lhs, Column):
        return None

    assert condition.lhs.name in _SNUBA_TO_RELAY_FIELDS, f"Unsupported field {condition.lhs.name}"

    return {
        "op": condition.op.name.lower(),
        "name": _SNUBA_TO_RELAY_FIELDS[condition.lhs.name],
        "value": condition.rhs,
    }


def _get_query_builder():
    from sentry.search.events.builder import QueryBuilder

    return QueryBuilder(
        dataset=Dataset.Transactions,
        params={"start": datetime.now(), "end": datetime.now()},
    )
