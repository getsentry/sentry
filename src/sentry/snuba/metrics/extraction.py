import hashlib
import logging
import re
from typing import (
    Any,
    Dict,
    Literal,
    Optional,
    Sequence,
    Tuple,
    Type,
    TypedDict,
    TypeVar,
    Union,
    cast,
)

from typing_extensions import NotRequired

from sentry.api import event_search
from sentry.api.event_search import ParenExpression, SearchFilter
from sentry.exceptions import InvalidSearchQuery
from sentry.search.events import fields
from sentry.snuba.dataset import Dataset
from sentry.snuba.metrics.utils import MetricOperationType
from sentry.snuba.models import SnubaQuery
from sentry.utils.snuba import resolve_column

logger = logging.getLogger(__name__)

# Name component of MRIs used for custom alert metrics.
CUSTOM_ALERT_METRIC_NAME = "transactions/on_demand"
QUERY_HASH_KEY = "query_hash"

# Base type for conditions to evaluate on payloads.
# TODO: Streamline with dynamic sampling.
RuleCondition = Union["LogicalRuleCondition", "ComparingRuleCondition", "NotRuleCondition"]

# Maps from Discover's field names to event protocol paths. See Relay's
# ``FieldValueProvider`` for supported fields. All fields need to be prefixed
# with "event.".
_SEARCH_TO_PROTOCOL_FIELDS = {
    # Top-level fields
    "release": "release",
    "dist": "dist",
    "environment": "environment",
    "transaction": "transaction",
    "platform": "platform",
    # Top-level structures ("interfaces")
    "user.email": "user.email",
    "user.id": "user.id",
    "user.ip_address": "user.ip_address",
    "user.name": "user.name",
    "user.segment": "user.segment",
    "geo.city": "user.geo.city",
    "geo.country_code": "user.geo.country_code",
    "geo.region": "user.geo.region",
    "geo.subdivision": "user.geo.subdivision",
    "http.method": "request.method",
    # Subset of context fields
    "device.name": "contexts.device.name",
    "device.family": "contexts.device.family",
    "os.name": "contexts.os.name",
    "os.version": "contexts.os.version",
    "browser.name": "contexts.browser.name",
    "browser.version": "contexts.browser.version",
    "transaction.op": "contexts.trace.op",
    "transaction.status": "contexts.trace.status",
    "http.status_code": "contexts.response.status_code",
    # Computed fields
    "transaction.duration": "duration",
    "release.build": "release.build",
    "release.package": "release.package",
    "release.version": "release.version.short",
    # Tags, measurements, and breakdowns are mapped by the converter
}

# Maps from Discover's syntax to Relay rule condition operators.
_SEARCH_TO_RELAY_OPERATORS: Dict[str, "CompareOp"] = {
    "=": "eq",
    "!=": "eq",  # combined with external negation
    "<": "lt",
    "<=": "lte",
    ">": "gt",
    ">=": "gte",
}

# Maps plain Discover functions to metric aggregation functions. Derived metrics
# are not part of this mapping.
_SEARCH_TO_METRIC_AGGREGATES: Dict[str, Optional[MetricOperationType]] = {
    "count": "sum",
    "avg": "avg",
    "max": "max",
    "p50": "p50",
    "p75": "p75",
    "p95": "p95",
    "p99": "p99",
    # generic percentile is not supported by metrics layer.
}

# Mapping to infer metric type from Discover function.
_AGGREGATE_TO_METRIC_TYPE = {
    "count": "c",
    # TODO(ogi): support count_if
    "avg": "d",
    "max": "d",
    "p50": "d",
    "p75": "d",
    "p95": "d",
    "p99": "d",
}

# Query fields that on their own do not require on-demand metric extraction.
_STANDARD_METRIC_FIELDS = [
    "release",
    "dist",
    "environment",
    "transaction",
    "platform",
    "transaction.status",
    "transaction.op",
    "http.method",
    "http.status_code",
    "browser.name",
    "os.name",
    "geo.country_code",
    "event.type",
]

# Operators used in ``ComparingRuleCondition``.
CompareOp = Literal["eq", "gt", "gte", "lt", "lte", "glob"]

QueryOp = Literal["AND", "OR"]
QueryToken = Union[SearchFilter, QueryOp, ParenExpression]


class ComparingRuleCondition(TypedDict):
    """RuleCondition that compares a named field to a reference value."""

    op: CompareOp
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


def is_on_demand_query(dataset: Optional[Union[str, Dataset]], query: Optional[str]) -> bool:
    """Returns ``True`` if the dataset is performance metrics and query contains non-standard search fields."""

    if not dataset or not query:
        return False

    if Dataset(dataset) != Dataset.PerformanceMetrics:
        return False

    try:
        return not _is_standard_metrics_compatible(event_search.parse_search_query(query))
    except InvalidSearchQuery:
        logger.error(f"Failed to parse search query: {query}", exc_info=True)
        return False


def _is_standard_metrics_compatible(tokens: Sequence[QueryToken]) -> bool:
    """
    Recursively checks if any of the supplied token contain search filters that can't be handled by standard metrics.
    """

    for token in tokens:
        if not _is_standard_metrics_search_filter(token):
            return False

    return True


def _is_standard_metrics_search_filter(token: QueryToken) -> bool:
    if isinstance(token, SearchFilter):
        return token.key.name in _STANDARD_METRIC_FIELDS

    if isinstance(token, ParenExpression):
        return _is_standard_metrics_compatible(token.children)

    return True


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

        # On-demand metrics are implicitly transaction metrics. Remove the
        # filter from the query since it can't be translated to a RuleCondition.
        self._query = re.sub(r"event\.type:transaction\s*", "", query)

        relay_field, metric_type, op = _extract_field_info(field)
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

        tokens = event_search.parse_search_query(self._query)
        assert tokens, "This query should not use on demand metrics"
        return SearchQueryConverter(tokens).convert()


def _extract_field_info(aggregate: str) -> Tuple[Optional[str], str, MetricOperationType]:
    """
    Extracts the field name, metric type and metric operation from a Discover
    function call.

    This does not support derived metrics such as ``apdex`` and aggregates with
    filters (``count_if``).
    """
    name, arguments, _alias = fields.parse_function(aggregate)

    # TODO: Add support for derived metrics: failure_rate, apdex, eps, epm, tps, tpm

    metric_type = _AGGREGATE_TO_METRIC_TYPE.get(name)
    metric_op = _SEARCH_TO_METRIC_AGGREGATES.get(name)
    assert metric_type and metric_op, f"Unsupported aggregate function {name}"

    if metric_type == "c":
        assert not arguments, "`count()` does not support arguments"
        return None, metric_type, metric_op
    else:
        assert len(arguments) == 1, "Only one parameter is supported"
        return _map_field_name(arguments[0]), metric_type, metric_op


def _map_field_name(search_key: str) -> str:
    """
    Maps a the name of a field in a search query to the event protocol path.

    Raises an exception if the field is not supported.
    """
    # Map known fields using a static mapping.
    if field := _SEARCH_TO_PROTOCOL_FIELDS.get(search_key):
        return f"event.{field}"

    # Measurements support generic access.
    if search_key.startswith("measurements."):
        return f"event.{search_key}"

    # Run a schema-aware check for tags. Always use the resolver output,
    # since it accounts for passing `tags[foo]` as key.
    resolved = (resolve_column(Dataset.Transactions))(search_key)
    if resolved.startswith("tags["):
        return f"event.tags.{resolved[5:-1]}"

    raise ValueError(f"Unsupported query field {search_key}")


T = TypeVar("T")


class SearchQueryConverter:
    """
    A converter from search query token stream to rule conditions.

    Pass a token stream obtained from `parse_search_query` to the constructor.
    The converter can be used exactly once.
    """

    def __init__(self, tokens: Sequence[QueryToken]):
        self._tokens = tokens
        self._position = 0

    def convert(self) -> RuleCondition:
        """
        Converts the token stream into a rule condition.

        This function can raise an exception if the token stream is structurally
        invalid or contains fields that are not supported by the rule engine.
        """

        condition = self._expr()
        if self._position < len(self._tokens):
            raise ValueError("Unexpected trailing tokens")
        return condition

    def _peek(self) -> Optional[QueryToken]:
        """Returns the next token without consuming it."""

        if self._position < len(self._tokens):
            return self._tokens[self._position]
        else:
            return None

    def _consume(self, pattern: Union[str, Type[T]]) -> Optional[T]:
        """
        Consumes the next token if it matches the given pattern.

        The pattern can be:
         - a literal string, in which case the token must be equal to the string
         - a type, in which case the token must be an instance of the type

        Returns the token if it matches, or ``None`` otherwise.
        """
        token = self._peek()

        if isinstance(pattern, str) and token != pattern:
            return None
        elif isinstance(pattern, type) and not isinstance(token, pattern):
            return None

        self._position += 1
        return cast(T, token)

    def _expr(self) -> RuleCondition:
        terms = [self._term()]

        while self._consume("OR") is not None:
            terms.append(self._term())

        if len(terms) == 1:
            return terms[0]
        else:
            return {"op": "or", "inner": terms}

    def _term(self) -> RuleCondition:
        factors = [self._factor()]

        while self._peek() not in ("OR", None):
            self._consume("AND")  # AND is optional and implicit, ignore if present.
            factors.append(self._factor())

        if len(factors) == 1:
            return factors[0]
        else:
            return {"op": "and", "inner": factors}

    def _factor(self) -> RuleCondition:
        if filt := self._consume(SearchFilter):
            return self._filter(filt)
        elif paren := self._consume(ParenExpression):
            return SearchQueryConverter(paren.children).convert()
        elif token := self._peek():
            raise ValueError(f"Unexpected token {token}")
        else:
            raise ValueError("Unexpected end of query")

    def _filter(self, token: SearchFilter) -> RuleCondition:
        operator = _SEARCH_TO_RELAY_OPERATORS.get(token.operator)
        if not operator:
            raise ValueError(f"Unsupported operator {token.operator}")

        value: Any = token.value.raw_value
        if operator == "eq" and token.value.is_wildcard():
            condition: RuleCondition = {
                "op": "glob",
                "name": _map_field_name(token.key.name),
                "value": [value],
            }
        else:
            # Special case: `x != ""` is the result of a `has:x` query, which
            # needs to be translated as `not(x == null)`.
            if token.operator == "!=" and value == "":
                value = None
            if isinstance(value, str):
                value = event_search.translate_escape_sequences(value)
            condition = {
                "op": operator,
                "name": _map_field_name(token.key.name),
                "value": value,
            }

        if token.operator == "!=":
            condition = {"op": "not", "inner": condition}

        return condition
