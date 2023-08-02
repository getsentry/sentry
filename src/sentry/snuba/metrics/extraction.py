import hashlib
import logging
import re
from abc import ABC, abstractmethod
from typing import (
    Any,
    Dict,
    Generic,
    List,
    Literal,
    NamedTuple,
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
from sentry.api.event_search import ParenExpression, SearchFilter, SearchKey, SearchValue
from sentry.constants import DataCategory
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
Variables = Dict[str, Any]


class VariableSearchValue(SearchValue):
    variable_name: str

    # TODO: possibly add expression here.

    def get_value(self, variables: Variables) -> Any:
        value = variables.get(self.variable_name)
        if value is None:
            raise InvalidSearchQuery(f"The variable {self.variable_name} is not initialized")

        return value


class DerivedMetricComponent(NamedTuple):
    metric_type: str
    field: Optional[str] = None
    conditions: Sequence[QueryToken] = []

    def merge_conditions(
        self, upstream_conditions: Sequence[QueryToken]
    ) -> "DerivedMetricComponent":
        # TODO: implement better merging that can optimize the tree structure.
        return DerivedMetricComponent(
            metric_type=self.metric_type,
            field=self.field,
            conditions=[
                ParenExpression(children=self.conditions),
                "AND",
                ParenExpression(children=upstream_conditions),
            ],
        )


class DerivedMetric(ABC):
    @abstractmethod
    def get_derived_metric_name(self) -> str:
        pass

    @abstractmethod
    def get_components(self):
        pass

    @abstractmethod
    def get_variables(self) -> Variables:
        pass


class FailureRate(DerivedMetric):
    def get_derived_metric_name(self) -> str:
        return "failure_rate()"

    def get_components(self):
        return [
            DerivedMetricComponent(
                metric_type="c",
                conditions=[
                    SearchFilter(
                        key=SearchKey(name="transaction.status"),
                        operator="=",
                        value=SearchValue(raw_value="aborted"),
                    )
                ],
            ),
            DerivedMetricComponent(
                metric_type="c",
            ),
        ]

    def get_variables(self) -> Variables:
        return {}


_DERIVED_METRICS: Dict[str, DerivedMetric] = {
    "failure_rate()": FailureRate(),
}


# # TODO: implement definition of filters as a proper expression tree and use the field directly with the entity encoding,
# #  since we know that at compile time.
# # Derived metrics to their components.
# _DERIVED_METRIC_TO_COMPONENTS: Dict[str, List[DerivedMetricComponent]] = {
#     "failure_rate()": [
#         DerivedMetricComponent(metric_type="c", conditions=),
#         DerivedMetricComponent(metric_type="c"),
#     ],
#     # "apdex()": [
#     #     # TODO: in some cases we want to extract LCP and in some DURATION, we need to implement logic to check this.
#     #     DerivedMetricComponent(
#     #         field="count(transaction.duration)", query="transaction.duration:<=T"
#     #     ),  # satisfactory
#     #     DerivedMetricComponent(
#     #         field="count(transaction.duration)",
#     #         query="transaction.duration:>T AND transaction.duration:<=4T",
#     #     ),  # tolerable
#     #     DerivedMetricComponent(
#     #         field="count(transaction.duration)", query="transaction.duration:>4T"
#     #     ),  # frustrated
#     # ],
# }


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


def is_on_demand_snuba_query(snuba_query: SnubaQuery) -> bool:
    """Returns ``True`` if the snuba query can't be supported by standard metrics."""
    return is_on_demand_query(snuba_query.dataset, snuba_query.aggregate, snuba_query.query)


def is_on_demand_query(
    dataset: Optional[Union[str, Dataset]], aggregate: str, query: Optional[str]
) -> bool:
    """Returns ``True`` if the dataset is performance metrics and query contains non-standard search fields."""

    if not dataset or Dataset(dataset) != Dataset.PerformanceMetrics:
        return False

    for field in _get_aggregate_fields(aggregate):
        if not _is_standard_metrics_field(field):
            return True

    try:
        return not _is_standard_metrics_query(event_search.parse_search_query(query or ""))
    except InvalidSearchQuery:
        logger.error(f"Failed to parse search query: {query}", exc_info=True)
        return False


def _get_aggregate_fields(aggregate: str) -> Sequence[str]:
    """
    Returns any fields referenced by the arguments of supported aggregate
    functions, otherwise ``None``.
    """

    # count_if is currently the only supported function, exit early
    if not aggregate.startswith("count_if("):
        return []

    try:
        function, arguments, _ = fields.parse_function(aggregate)
        if function == "count_if" and arguments:
            return [arguments[0]]
    except InvalidSearchQuery:
        logger.error(f"Failed to parse aggregate: {aggregate}", exc_info=True)

    return []


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
        return _is_standard_metrics_field(token.key.name)

    if isinstance(token, ParenExpression):
        return _is_standard_metrics_query(token.children)

    return True


def _is_standard_metrics_field(field: str) -> bool:
    return field in _STANDARD_METRIC_FIELDS


class OndemandMetricSpec:
    """
    Contains the information required to query or extract an on-demand metric.
    """

    # The data type of the metric to extract.
    metric_type: str
    # The payload field to extract the metric value from. Empty for counters.
    field: Optional[str]
    # The aggregation to execute on the metric.
    op: MetricOperationType

    # The original query used to construct the metric spec.
    _query: str
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

        # On-demand metrics are implicitly transaction metrics. Remove the
        # filter from the query since it can't be translated to a RuleCondition.
        self._query = re.sub(r"event\.type:transaction\s*", "", query)
        self._init_aggregate(field)

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

        # TODO: Figure out how to support multiple fields and different but equivalent queries
        str_to_hash = f"{self.field};{self._query}"
        return hashlib.shake_128(bytes(str_to_hash, encoding="ascii")).hexdigest(4)

    def condition(self) -> RuleCondition:
        """Returns a condition that should be fulfilled for the on-demand metric to be extracted."""

        tokens = event_search.parse_search_query(self._query)
        if not tokens:
            assert self._field_condition is not None, "This query should not use on demand metrics"
            return self._field_condition

        condition = SearchQueryConverter(tokens, {}).convert()
        if not self._field_condition:
            return condition

        if condition["op"] != "and":
            return {"op": "and", "inner": [condition, self._field_condition]}

        condition["inner"].append(self._field_condition)
        return condition


class OndemandMetricSpecV2(NamedTuple):
    metric_type: str
    field: Optional[str]
    rule_condition: RuleCondition

    @property
    def mri(self) -> str:
        """The unique identifier of the on-demand metric."""
        return f"{self.metric_type}:{CUSTOM_ALERT_METRIC_NAME}@none"

    def query_hash(self) -> str:
        """Returns a hash of the query and field to be used as a unique identifier for the on-demand metric."""

        # TODO: Figure out how to support multiple fields and different but equivalent queries and improve hashing of
        #  rule condition.
        str_to_hash = f"{self.field};{str(self.rule_condition)}"
        return hashlib.shake_128(bytes(str_to_hash, encoding="ascii")).hexdigest(4)

    def to_metric_spec(self) -> MetricSpec:
        return {
            "category": DataCategory.TRANSACTION.api_name(),
            "mri": self.mri,
            "field": self.field,
            "condition": self.rule_condition,
            "tags": [{"key": QUERY_HASH_KEY, "value": self.query_hash()}],
        }


Input = TypeVar("Input")
Output = TypeVar("Output")


class OndemandParser(ABC, Generic[Input, Output]):
    @abstractmethod
    def parse(self, value: Input) -> Optional[Output]:
        pass


class FieldParsingResult(NamedTuple):
    function: str
    arguments: List[str]
    alias: str


class FieldParser(OndemandParser[str, FieldParsingResult]):
    def parse(self, value: str) -> Optional[FieldParsingResult]:
        pass


class QueryParsingResult(NamedTuple):
    conditions: Sequence[QueryToken]


class QueryParser(OndemandParser[str, QueryParsingResult]):
    def parse(self, value: str) -> Optional[QueryParsingResult]:
        pass


class OndemandMetricSpecBuilder:
    def __init__(
        self,
        field_parser: OndemandParser[str, FieldParsingResult],
        query_parser: OndemandParser[str, QueryParsingResult],
    ):
        self._field_parser = field_parser
        self._query_parser = query_parser

    def build_specs(self, field: str, query: str) -> List[OndemandMetricSpecV2]:
        if (derived_metric := _DERIVED_METRICS.get(field)) is not None:
            return self._handle_derived_metric(field, query, derived_metric)
        else:
            return self._handle_normal_metric(field, query)

    def _handle_normal_metric(self, field: str, query: str) -> List[OndemandMetricSpecV2]:
        # On-demand metrics are implicitly transaction metrics. Remove the
        # filter from the query since it can't be translated to a RuleCondition.
        query = re.sub(r"event\.type:transaction\s*", "", query)

        metric_type, field = self._init_field(field)
        rule_condition = self._init_query(field, query)

        return [
            OndemandMetricSpecV2(
                metric_type=metric_type, field=field, rule_condition=rule_condition
            )
        ]

    def _init_field(self, field: str) -> Tuple[str, Optional[str]]:
        parsed_field = self._field_parser.parse(field)
        if parsed_field is None:
            raise Exception(f"Unable to parse the field {field}")
        elif (
            parsed_field not in _AGGREGATE_TO_METRIC_TYPE
            and parsed_field.function not in _SEARCH_TO_METRIC_AGGREGATES
        ):
            raise Exception(f"Unsupported aggregate function {parsed_field.function}")

        metric_type = _AGGREGATE_TO_METRIC_TYPE[parsed_field.function]
        if metric_type != "c":
            assert len(parsed_field.arguments) == 1, "Only one parameter is supported"
            return metric_type, _map_field_name(parsed_field.arguments[0])

        return metric_type, None

    def _init_query(self, field: str, query: str) -> RuleCondition:
        # TODO: find a way to avoid double parsing of the field.
        parsed_field = self._field_parser.parse(field)
        if parsed_field is None:
            raise Exception(f"Unable to parse the field {field}")

        # TODO: implement better system for handling additional rule conditions computation.
        count_if_rule_condition = None
        if parsed_field.function == "count_if":
            key, op, value = parsed_field.arguments
            count_if_rule_condition = _convert_countif_filter(key, op, value)

        parsed_query = self._query_parser.parse(query)
        if not parsed_query:
            assert (
                count_if_rule_condition is not None
            ), "This query should not use on demand metrics"
            return count_if_rule_condition

        condition = SearchQueryConverter(parsed_query.conditions, {}).convert()
        if not count_if_rule_condition:
            return condition

        # In case we have a top level rule which is not an "and" we have to wrap it.
        if condition["op"] != "and":
            return {"op": "and", "inner": [condition, count_if_rule_condition]}

        # In the other case, we can just flatten the conditions.
        condition["inner"].append(count_if_rule_condition)
        return condition

    def _handle_derived_metric(
        self, field: str, query: str, derived_metric: DerivedMetric
    ) -> List[OndemandMetricSpecV2]:
        return []


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

    def __init__(self, tokens: Sequence[QueryToken], variables: Variables):
        self._tokens = tokens
        # TODO: decide whether we want to inject variables in `convert` or keep them instance based.
        self._variables = variables
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
            return SearchQueryConverter(paren.children, self._variables).convert()
        elif token := self._peek():
            raise ValueError(f"Unexpected token {token}")
        else:
            raise ValueError("Unexpected end of query")

    def _filter(self, token: SearchFilter) -> RuleCondition:
        operator = _SEARCH_TO_RELAY_OPERATORS.get(token.operator)
        if not operator:
            raise ValueError(f"Unsupported operator {token.operator}")

        value: Any = self._eval_search_value(token.value)
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

    def _eval_search_value(
        self, search_value: Union[SearchValue, VariableSearchValue]
    ) -> Optional[Any]:
        if isinstance(search_value, SearchValue):
            return search_value.raw_value
        elif isinstance(search_value, VariableSearchValue):
            return search_value.get_value(self._variables)
        else:
            return None
