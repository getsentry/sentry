import hashlib
import logging
import re
from dataclasses import dataclass
from typing import (
    Any,
    Dict,
    List,
    Literal,
    Optional,
    Sequence,
    Type,
    TypedDict,
    TypeVar,
    Union,
    cast,
)

from typing_extensions import NotRequired

from sentry.api import event_search
from sentry.api.event_search import AggregateFilter, ParenExpression, SearchFilter
from sentry.discover.arithmetic import is_equation
from sentry.exceptions import InvalidSearchQuery
from sentry.search.events import fields
from sentry.snuba.dataset import Dataset
from sentry.snuba.metrics.utils import MetricOperationType
from sentry.utils.snuba import is_measurement, is_span_op_breakdown, resolve_column

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
# List of UI supported search fields is defined in sentry/static/app/utils/fields/index.ts
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
    "IN": "eq",
    "NOT IN": "eq",  # combined with external negation
}

# Maps from parsed count_if condition args to Relay rule condition operators.
_COUNTIF_TO_RELAY_OPERATORS: Dict[str, "CompareOp"] = {
    "equals": "eq",
    "notEquals": "eq",
    "less": "lt",
    "greater": "gt",
    "lessOrEquals": "lte",
    "greaterOrEquals": "gte",
}

# Maps plain Discover functions to metric aggregation functions. Derived metrics
# are not part of this mapping.
_SEARCH_TO_METRIC_AGGREGATES: Dict[str, MetricOperationType] = {
    "count": "sum",
    "count_if": "sum",
    "avg": "avg",
    "min": "min",
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
    "count_if": "c",
    "avg": "d",
    "max": "d",
    "p50": "d",
    "p75": "d",
    "p95": "d",
    "p99": "d",
}

# Query fields that on their own do not require on-demand metric extraction but if present in an on-demand query
# will be converted to metric extraction conditions.
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
    # These fields are skipped during on demand spec generation and will not be converted to metric extraction conditions
    "event.type",
    "project",
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
    inner: List[RuleCondition]


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


@dataclass(frozen=True)
class SupportedBy:
    """Result of a check for standard and on-demand metric support."""

    standard_metrics: bool
    on_demand_metrics: bool

    @classmethod
    def neither(cls):
        return cls(standard_metrics=False, on_demand_metrics=False)

    @classmethod
    def both(cls):
        return cls(standard_metrics=True, on_demand_metrics=True)

    @classmethod
    def combine(cls, *supported_by):
        return cls(
            standard_metrics=all(s.standard_metrics for s in supported_by),
            on_demand_metrics=all(s.on_demand_metrics for s in supported_by),
        )


def should_use_on_demand_metrics(
    dataset: Optional[Union[str, Dataset]],
    aggregate: str,
    query: Optional[str],
    prefilling: bool = False,
) -> bool:
    """On-demand metrics are used if the aggregate and query are supported by on-demand metrics but not standard"""
    supported_datasets = [Dataset.PerformanceMetrics]
    # In case we are running a prefill, we want to support also transactions, since our goal is to start extracting
    # metrics that will be needed after a query is converted from using transactions to metrics.
    if prefilling:
        supported_datasets.append(Dataset.Transactions)

    if not dataset or Dataset(dataset) not in supported_datasets:
        return False

    aggregate_supported_by = _get_aggregate_supported_by(aggregate)
    query_supported_by = _get_query_supported_by(query)

    supported_by = SupportedBy.combine(aggregate_supported_by, query_supported_by)

    return not supported_by.standard_metrics and supported_by.on_demand_metrics


def _get_aggregate_supported_by(aggregate: str) -> SupportedBy:
    try:
        if is_equation(aggregate):
            # TODO(Ogi): Implement support for equations
            return SupportedBy.neither()

        function, args, _ = fields.parse_function(aggregate)

        function_support = _get_function_support(function)
        args_support = _get_args_support(args)

        return SupportedBy.combine(function_support, args_support)

    except InvalidSearchQuery:
        logger.error(f"Failed to parse aggregate: {aggregate}", exc_info=True)

    return SupportedBy.neither()


def _get_function_support(function: str) -> SupportedBy:
    return SupportedBy(
        standard_metrics=True,
        on_demand_metrics=function in _SEARCH_TO_METRIC_AGGREGATES
        and function in _AGGREGATE_TO_METRIC_TYPE,
    )


def _get_args_support(args: Sequence[str]) -> SupportedBy:
    if len(args) == 0:
        return SupportedBy.both()

    arg = args[0]

    standard_metrics = _is_standard_metrics_field(arg)
    on_demand_metrics = _is_on_demand_supported_field(arg)

    return SupportedBy(standard_metrics=standard_metrics, on_demand_metrics=on_demand_metrics)


def _get_query_supported_by(query: Optional[str]) -> SupportedBy:
    try:
        parsed_query = event_search.parse_search_query(query)

        standard_metrics = _is_standard_metrics_query(parsed_query)
        on_demand_metrics = _is_on_demand_supported_query(parsed_query)

        return SupportedBy(standard_metrics=standard_metrics, on_demand_metrics=on_demand_metrics)
    except InvalidSearchQuery:
        logger.error(f"Failed to parse search query: {query}", exc_info=True)
        return SupportedBy.neither()


def _is_standard_metrics_query(tokens: Sequence[QueryToken]) -> bool:
    """
    Recursively checks if any of the supplied token contain search filters that can't be handled by standard metrics.
    """

    for token in tokens:
        if not _is_standard_metrics_search_filter(token):
            return False

    return True


def _is_standard_metrics_search_filter(token: QueryToken) -> bool:
    if isinstance(token, SearchFilter):
        return _is_standard_metrics_search_term(token.key.name)

    if isinstance(token, ParenExpression):
        return _is_standard_metrics_query(token.children)

    return True


def _is_on_demand_supported_query(tokens: Sequence[QueryToken]) -> bool:
    """
    Recursively checks if any of the supplied token contain search filters that can't be handled by standard metrics.
    """

    for token in tokens:
        if not _is_on_demand_supported_search_filter(token):
            return False

    return True


def _is_on_demand_supported_search_filter(token: QueryToken) -> bool:
    if isinstance(token, AggregateFilter):
        return False

    if isinstance(token, SearchFilter):
        if not _SEARCH_TO_RELAY_OPERATORS.get(token.operator):
            return False

        return not _is_excluding_transactions(token) and _is_on_demand_supported_field(
            token.key.name
        )

    if isinstance(token, ParenExpression):
        return _is_on_demand_supported_query(token.children)

    return True


def _is_excluding_transactions(token: SearchFilter) -> bool:
    return (
        token.key.name == "event.type"
        and token.operator == "!="
        and token.value.raw_value == "transaction"
    )


def _is_standard_metrics_field(field: str) -> bool:
    return (
        _is_standard_metrics_search_term(field)
        or is_measurement(field)
        or is_span_op_breakdown(field)
        or field == "transaction.duration"
    )


def _is_standard_metrics_search_term(field: str) -> bool:
    return field in _STANDARD_METRIC_FIELDS


def _is_on_demand_supported_field(field: str) -> bool:
    try:
        _map_field_name(field)
        return True
    except ValueError:
        return False


def to_standard_metrics_query(query: str) -> str:
    """
    Converts a query containing on demand search fields to a query that can be
    run using only standard metrics.

    This is done by removing conditions requiring on-demand metrics.

    NOTE: This does **NOT** create an equivalent query. It only creates the best
    approximation available using only standard metrics. It is used for approximating
    the volume of an on-demand metrics query using a combination of indexed and metrics data.

    Examples:
        "environment:dev AND transaction.duration:>=1s" -> "environment:dev"
        "environment:dev OR transaction.duration:>=1s" -> "environment:dev"
        "transaction.duration:>=1s OR browser.version:1" -> ""
        "transaction.duration:>=1s AND browser.version:1" -> ""
    """
    try:
        tokens = event_search.parse_search_query(query)
    except InvalidSearchQuery:
        logger.error(f"Failed to parse search query: {query}", exc_info=True)
        raise

    cleaned_query = to_standard_metrics_tokens(tokens)
    return query_tokens_to_string(cleaned_query)


def to_standard_metrics_tokens(tokens: Sequence[QueryToken]) -> Sequence[QueryToken]:
    """
    Converts a query in token form containing on-demand search fields to a query
    that has all on-demand filters removed and can be run using only standard metrics.
    """
    remaining_tokens = _remove_on_demand_search_filters(tokens)
    cleaned_query = cleanup_query(remaining_tokens)
    return cleaned_query


def query_tokens_to_string(tokens: Sequence[QueryToken]) -> str:
    """
    Converts a list of tokens into a query string.
    """
    ret_val = ""
    for token in tokens:
        if isinstance(token, str):
            ret_val += f" {token}"
        else:
            ret_val += f" {token.to_query_string()}"
    return ret_val.strip()


def _remove_on_demand_search_filters(tokens: Sequence[QueryToken]) -> Sequence[QueryToken]:
    """
    removes tokens that contain filters that can only be handled by on demand metrics.
    """
    ret_val: List[QueryToken] = []
    for token in tokens:
        if isinstance(token, SearchFilter):
            if _is_standard_metrics_search_filter(token):
                ret_val.append(token)
        elif isinstance(token, ParenExpression):
            ret_val.append(ParenExpression(_remove_on_demand_search_filters(token.children)))
        else:
            ret_val.append(token)
    return ret_val


def cleanup_query(tokens: Sequence[QueryToken]) -> Sequence[QueryToken]:
    """
    Recreates a valid query from an original query that has had on demand search filters removed.

    When removing filters from a query it is possible to create invalid queries.
    For example removing the on demand filters from "transaction.duration:>=1s OR browser.version:1 AND environment:dev"
    would result in "OR AND environment:dev" which is not a valid query this should be cleaned to "environment:dev.

    "release:internal and browser.version:1 or os.name:android" => "release:internal or and os.name:android" which would be
    cleaned to "release:internal or os.name:android"
    """
    tokens = list(tokens)

    # remove empty parens
    removed_empty_parens: List[QueryToken] = []
    for token in tokens:
        if not isinstance(token, ParenExpression):
            removed_empty_parens.append(token)
        else:
            children = cleanup_query(token.children)
            if len(children) > 0:
                removed_empty_parens.append(ParenExpression(children))
    # remove AND and OR operators at the start of the query
    while len(removed_empty_parens) > 0 and isinstance(removed_empty_parens[0], str):
        removed_empty_parens.pop(0)

    # remove AND and OR operators at the end of the query
    while len(removed_empty_parens) > 0 and isinstance(removed_empty_parens[-1], str):
        removed_empty_parens.pop()

    # remove AND and OR operators that are next to each other
    ret_val = []
    previous_token: Optional[QueryToken] = None

    for token in removed_empty_parens:
        # this loop takes care of removing consecutive AND/OR operators (keeping only one of them)
        if isinstance(token, str) and isinstance(previous_token, str):
            token = cast(QueryOp, token.upper())
            # this handles two AND/OR operators next to each other, we must drop one of them
            # if we have an AND do nothing (AND will be merged in the previous token see comment below)
            # if we have an OR the resulting operator will be an OR
            # AND OR => OR
            # OR OR => OR
            # OR AND => OR
            # AND AND => AND
            if token == "OR":
                previous_token = "OR"
            continue
        elif previous_token is not None:
            ret_val.append(previous_token)
        previous_token = token
    # take care of the last token (if any)
    if previous_token is not None:
        ret_val.append(previous_token)

    return ret_val


class OnDemandMetricSpec:
    """
    Contains the information required to query or extract an on-demand metric.
    """

    # The data type of the metric to extract.
    metric_type: str
    # The payload field to extract the metric value from. Empty for counters.
    field: Optional[str]
    # The aggregation to execute on the metric.
    op: MetricOperationType

    # Parsed query tokens from the original query string. Already cleaned of unsupported/redundant filters.
    parsed_query: Sequence[QueryToken]
    # Rule condition parsed from the aggregate field expression.
    _field_condition: Optional[RuleCondition]

    def __init__(self, field: str, query: str):
        """
        Parses a selected column and query into an on demand metric spec containing the MRI, field and op.
        Currently, supports only one selected column.

        Has two main uses:
        1. Querying on-demand metrics.
        2. Generation of rules for on-demand metric extraction.

        """

        self._init_parsed_query(query)
        self._init_aggregate(field)

    def _init_parsed_query(self, query: str) -> None:
        # On-demand metrics are implicitly transaction metrics. Remove the
        # filters from the query that can't be translated to a RuleCondition.
        query = re.sub(r"event\.type:transaction\s*", "", query)
        # extend the following to also support project:"some-project"
        query = re.sub(r"project:[\w\d\"\-_]+\s*", "", query)

        self.parsed_query = cleanup_query(event_search.parse_search_query(query))

    def _init_aggregate(self, aggregate: str) -> None:
        """
        Extracts the field name, metric type and metric operation from a Discover
        function call.

        This does not support derived metrics such as ``apdex``.
        """

        # TODO: Add support for derived metrics: failure_rate, apdex, eps, epm, tps, tpm
        function, arguments, _alias = fields.parse_function(aggregate)
        assert (
            function in _AGGREGATE_TO_METRIC_TYPE and function in _SEARCH_TO_METRIC_AGGREGATES
        ), f"Unsupported aggregate function {function}"
        self.metric_type = _AGGREGATE_TO_METRIC_TYPE[function]
        self.op = _SEARCH_TO_METRIC_AGGREGATES[function]

        self.field = None
        self._field_condition = None

        if self.metric_type != "c":
            assert len(arguments) == 1, "Only one parameter is supported"
            self.field = _map_field_name(arguments[0])

        if function == "count_if":
            key, op, value = arguments
            self._field_condition = _convert_countif_filter(key, op, value)

    @property
    def mri(self) -> str:
        """The unique identifier of the on-demand metric."""
        return f"{self.metric_type}:{CUSTOM_ALERT_METRIC_NAME}@none"

    def query_hash(self) -> str:
        """Returns a hash of the query and field to be used as a unique identifier for the on-demand metric."""
        sorted_conditions = str(_deep_sorted(self.condition()))
        str_to_hash = f"{self.field};{sorted_conditions}"
        return hashlib.shake_128(bytes(str_to_hash, encoding="ascii")).hexdigest(4)

    def condition(self) -> RuleCondition:
        """Returns a condition that should be fulfilled for the on-demand metric to be extracted."""

        if not self.parsed_query:
            assert self._field_condition is not None, "This query should not use on demand metrics"
            return self._field_condition

        condition = SearchQueryConverter(self.parsed_query).convert()
        if not self._field_condition:
            return condition

        if condition["op"] != "and":
            return {"op": "and", "inner": [condition, self._field_condition]}

        condition["inner"].append(self._field_condition)
        return condition


def _convert_countif_filter(key: str, op: str, value: str) -> RuleCondition:
    """Maps ``count_if`` arguments to a ``RuleCondition``."""
    assert op in _COUNTIF_TO_RELAY_OPERATORS, f"Unsupported `count_if` operator {op}"

    condition: RuleCondition = {
        "op": _COUNTIF_TO_RELAY_OPERATORS[op],
        "name": _map_field_name(key),
        "value": fields.normalize_count_if_value({"column": key, "value": value}),
    }

    if op == "notEquals":
        condition = {"op": "not", "inner": condition}

    return condition


def _map_field_name(search_key: str) -> str:
    """
    Maps a name of a field in a search query to the event protocol path.

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

        if token.operator == "!=" or token.operator == "NOT IN":
            condition = {"op": "not", "inner": condition}

        return condition


def _deep_sorted(value: Union[Any, Dict[Any, Any]]) -> Union[Any, Dict[Any, Any]]:
    if isinstance(value, dict):
        return {key: _deep_sorted(value) for key, value in sorted(value.items())}
    else:
        return value
