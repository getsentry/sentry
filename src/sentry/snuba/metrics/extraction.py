import hashlib
import logging
from datetime import datetime
from typing import Any, Dict, Literal, Optional, Sequence, Tuple, TypedDict, Union, cast

from snuba_sdk import BooleanCondition, Column, Condition
from typing_extensions import NotRequired

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
    "contexts[geo.country_code]": "event.geo.country_code",
    "http_method": "event.http.method",
    "release": "event.release",
    "transaction_name": "event.transaction",
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
    # TODO(ogi): Support fields whose resolution returns a function
    # "browser.name": "event.browser.name",
    # "http.status_code": "event.http.status_code",
    # "os.name": "event.os.name",
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

# TODO(ogi): support count_if
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


def is_on_demand_snuba_query(snuba_query: SnubaQuery) -> bool:
    """Returns ``True`` if the snuba query can't be supported by standard metrics."""

    return is_on_demand_query(snuba_query.dataset, snuba_query.query)


def is_on_demand_query(dataset: str, query: str) -> bool:
    """Returns ``True`` if the dataset and query combination can't be supported by standard metrics."""

    return dataset == Dataset.PerformanceMetrics.value and "transaction.duration" in query


class OndemandMetricSpec:
    """
    Contains the information required to query or extract an on-demand metric.
    """

    def __init__(self, field: str, query: str):
        """
        Parses a selected column and query into an on demand metric spec containing the MRI, field and op.
        Currently, supports only one selected column.

        Has two main uses:
        1. Querying on-demand metrics.
        2. Generation of rules for on-demand metric extraction.

        """
        relay_field, metric_type, op = _extract_field_info(field)

        self._query = query
        self.field = relay_field
        self.metric_type = metric_type
        self.mri = f"{metric_type}:{CUSTOM_ALERT_METRIC_NAME}@none"
        self.op = op

    def query_hash(self) -> str:
        """Returns a hash of the query and field to be used as a unique identifier for the on-demand metric."""

        # TODO: Figure out how to support multiple fields and different but equivalent queries
        str_to_hash = f"{self.field};{self._query}"
        return hashlib.shake_128(bytes(str_to_hash, encoding="ascii")).hexdigest(4)

    def condition(self) -> RuleCondition:
        """Returns a condition that should be fulfilled for the on-demand metric to be extracted."""

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
    # TODO: Find a way to perform resolve_column and resolve_conditions without instantiating a QueryBuilder
    from sentry.search.events.builder import QueryBuilder

    return QueryBuilder(
        dataset=Dataset.Transactions,
        # start and end parameters are required, but not used
        params={"start": datetime.now(), "end": datetime.now()},
    )
