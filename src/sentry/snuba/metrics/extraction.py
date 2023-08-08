import hashlib
import logging
import re
from abc import ABC, abstractmethod
from dataclasses import dataclass
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
from sentry.models import TRANSACTION_METRICS, Project, ProjectTransactionThreshold
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
    "transaction.lcp": "lcp",
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
    "max": "max",
    "p50": "p50",
    "p75": "p75",
    "p95": "p95",
    "p99": "p99",
    "failure_rate": "on_demand_failure_rate",
    "apdex": "on_demand_apdex",
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
    # With on demand metrics, evaluated metrics are actually stored, thus we have to choose a concrete metric type.
    "failure_rate": "c",
    "apdex": "c",
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

Variables = Dict[str, Any]


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
    return is_on_demand_metric_query(snuba_query.dataset, snuba_query.aggregate, snuba_query.query)


def is_on_demand_metric_query(
    dataset: Optional[Union[str, Dataset]], aggregate: str, query: Optional[str]
) -> bool:
    """Returns ``True`` if the dataset is performance metrics and query contains non-standard search fields."""
    if not dataset or Dataset(dataset) != Dataset.PerformanceMetrics:
        return False

    if is_standard_metrics_compatible(dataset, aggregate, query):
        return False

    for field in _get_aggregate_fields(aggregate):
        if not _is_on_demand_supported_field(field):
            return False
    try:
        return _is_on_demand_supported_query(event_search.parse_search_query(query))
    except InvalidSearchQuery:
        logger.error(f"Failed to parse search query: {query}", exc_info=True)
        return False


def is_standard_metrics_compatible(
    dataset: Optional[Union[str, Dataset]], aggregate: str, query: Optional[str]
) -> bool:
    """Returns ``True`` if the query can be supported by standard metrics."""

    if not dataset or Dataset(dataset) not in [Dataset.Metrics, Dataset.PerformanceMetrics]:
        return False

    for field in _get_aggregate_fields(aggregate):
        if not _is_standard_metrics_field(field):
            return False
    try:
        return _is_standard_metrics_query(event_search.parse_search_query(query))
    except InvalidSearchQuery:
        logger.error(f"Failed to parse search query: {query}", exc_info=True)
        return False


def _get_aggregate_fields(aggregate: str) -> Sequence[str]:
    """
    Returns any fields referenced by the arguments of supported aggregate
    functions, otherwise ``None``.
    """
    _SUPPORTED_AGG_FNS = ("count_if", "count_unique")

    if not aggregate.startswith(_SUPPORTED_AGG_FNS):
        return []

    try:
        function, arguments, _ = fields.parse_function(aggregate)
        if function in _SUPPORTED_AGG_FNS and arguments:
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


def to_standard_metrics_query(query: str) -> str:
    """
    Converts a query containing on demand search fields to a query that can be
    run using only standard metrics.

    This is done by removing conditions requiring on-demand metrics.

    NOTE: This does **NOT** create an equivalent query. It only creates the best
    approximation available using only standard metrics. It is used for approximating
    the volume of an on-demand metrics query using a combination of indexed and metrics data.

    Examples:
        "enviroment:dev AND transaction.duration:>=1s" -> "enviroment:dev"
        "enviroment:dev OR transaction.duration:>=1s" -> "enviroment:dev"
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


def _is_on_demand_supported_query(tokens: Sequence[QueryToken]) -> bool:
    """
    Recursively checks if any of the supplied token contain search filters that can't be handled by standard metrics.
    """

    for token in tokens:
        if not _is_on_demand_supported_search_filter(token):
            return False

    return True


def _is_on_demand_supported_search_filter(token: QueryToken) -> bool:
    if isinstance(token, SearchFilter):
        return _is_on_demand_supported_field(token.key.name)

    if isinstance(token, ParenExpression):
        return _is_on_demand_supported_query(token.children)

    return True


def _is_standard_metrics_field(field: str) -> bool:
    return field in _STANDARD_METRIC_FIELDS


def _is_on_demand_supported_field(field: str) -> bool:
    try:
        _map_field_name(field)
        return True
    except ValueError:
        return False


def _deep_sorted(value: Union[Any, Dict[Any, Any]]) -> Union[Any, Dict[Any, Any]]:
    if isinstance(value, dict):
        return {key: _deep_sorted(value) for key, value in sorted(value.items())}
    else:
        return value


class OndemandMetricSpec(NamedTuple):
    op: Optional[MetricOperationType]
    metric_type: str
    field: Optional[str]
    condition: RuleCondition
    tags_conditions: List[TagSpec]

    original_query: str

    @property
    def mri(self) -> str:
        """The unique identifier of the on-demand metric."""
        return f"{self.metric_type}:{CUSTOM_ALERT_METRIC_NAME}@none"

    def query_hash(self) -> str:
        """Returns a hash of the query and field to be used as a unique identifier for the on-demand metric."""
        sorted_conditions = str(_deep_sorted(self.condition))
        str_to_hash = f"{self.field};{sorted_conditions}"
        return hashlib.shake_128(bytes(str_to_hash, encoding="ascii")).hexdigest(4)

    def to_metric_spec(self) -> MetricSpec:
        extended_tags_conditions = self.tags_conditions.copy()
        extended_tags_conditions.append({"key": QUERY_HASH_KEY, "value": self.query_hash()})

        return {
            "category": DataCategory.TRANSACTION.api_name(),
            "mri": self.mri,
            "field": self.field,
            "condition": self.condition,
            "tags": extended_tags_conditions,
        }


@dataclass(frozen=True)
class DerivedMetricParams:
    params: Dict[str, Any]

    @staticmethod
    def empty():
        return DerivedMetricParams({})

    def add_param(self, param_key: str, param_value: Any):
        self.params[param_key] = param_value

    def consume(self, consumer: str) -> "DerivedMetricParamsConsumer":
        return DerivedMetricParamsConsumer(consumer=consumer, params=self)


class DerivedMetricParamsConsumer:
    def __init__(self, consumer: str, params: DerivedMetricParams):
        self.consumer = consumer
        self.params = params

        self._fetched_params: List[Any] = []

    def param(self, param_name: str) -> "DerivedMetricParamsConsumer":
        param_value = self.params.params.get(param_name)
        if param_value is None:
            raise Exception(
                f"Derived metric {self.consumer} requires parameter '{param_name}' but it was not supplied"
            )

        self._fetched_params.append(param_value)

        return self

    def get_all(self) -> List[Any]:
        return self._fetched_params


@dataclass(frozen=True)
class DerivedMetricComponent:
    tag_key: str
    tag_value: str
    condition: RuleCondition


class DerivedMetric(ABC):
    @abstractmethod
    def get_operation_type(self) -> MetricOperationType:
        pass

    @abstractmethod
    def get_components(
        self, derived_metric_params: DerivedMetricParams
    ) -> List[DerivedMetricComponent]:
        pass


class FailureRate(DerivedMetric):
    def get_operation_type(self) -> MetricOperationType:
        return "on_demand_failure_rate"

    def get_components(
        self, derived_metric_params: DerivedMetricParams
    ) -> List[DerivedMetricComponent]:
        return [
            DerivedMetricComponent(
                tag_key="failure",
                tag_value="true",
                condition={
                    "inner": {
                        "name": "event.contexts.trace.status",
                        "op": "eq",
                        "value": ["ok", "cancelled", "unknown"],
                    },
                    "op": "not",
                },
            ),
        ]


class Apdex(DerivedMetric):
    def get_operation_type(self) -> MetricOperationType:
        return "on_demand_apdex"

    def get_components(
        self, derived_metric_params: DerivedMetricParams
    ) -> List[DerivedMetricComponent]:
        apdex_threshold, field_to_extract = (
            derived_metric_params.consume(consumer=self.get_operation_type())
            .param("apdex_threshold")
            .param("field_to_extract")
            .get_all()
        )

        field = _map_field_name(field_to_extract)

        return [
            # Satisfactory.
            DerivedMetricComponent(
                tag_key="satisfaction",
                tag_value="satisfactory",
                condition={"name": field, "op": "lte", "value": apdex_threshold},
            ),
            # Tolerable.
            DerivedMetricComponent(
                tag_key="satisfaction",
                tag_value="tolerable",
                condition={
                    "inner": [
                        {"name": field, "op": "gt", "value": apdex_threshold},
                        {"name": field, "op": "lte", "value": apdex_threshold * 4},
                    ],
                    "op": "and",
                },
            ),
            # Frustrated.
            DerivedMetricComponent(
                tag_key="satisfaction",
                tag_value="frustrated",
                condition={"name": field, "op": "gt", "value": apdex_threshold * 4},
            ),
        ]


# Dynamic mapping between derived metric field name and derived metric definition.
_DERIVED_METRICS: Dict[MetricOperationType, DerivedMetric] = {
    derived_metric.get_operation_type(): derived_metric
    for derived_metric in [FailureRate(), Apdex()]
}


Input = TypeVar("Input")
Output = TypeVar("Output")


class OndemandParser(ABC, Generic[Input, Output]):
    @abstractmethod
    def parse(self, value: Input) -> Optional[Output]:
        pass


@dataclass(frozen=True)
class FieldParsingResult:
    function: str
    arguments: List[str]
    alias: str


class FieldParser(OndemandParser[str, FieldParsingResult]):
    def parse(self, value: str) -> Optional[FieldParsingResult]:
        try:
            function, arguments, alias = fields.parse_function(value)
            return FieldParsingResult(function=function, arguments=arguments, alias=alias)
        except InvalidSearchQuery:
            return None


@dataclass(frozen=True)
class QueryParsingResult:
    conditions: Sequence[QueryToken]


class QueryParser(OndemandParser[str, QueryParsingResult]):
    def parse(self, value: str) -> Optional[QueryParsingResult]:
        try:
            conditions = event_search.parse_search_query(value)
            return QueryParsingResult(conditions=conditions)
        except InvalidSearchQuery:
            return None


class OndemandMetricSpecBuilder:
    def __init__(
        self,
        field_parser: OndemandParser[str, FieldParsingResult],
        query_parser: OndemandParser[str, QueryParsingResult],
    ):
        self._field_parser = field_parser
        self._query_parser = query_parser

    @staticmethod
    def default() -> "OndemandMetricSpecBuilder":
        return OndemandMetricSpecBuilder(field_parser=FieldParser(), query_parser=QueryParser())

    def build_spec(
        self,
        field: str,
        query: str,
        derived_metric_params: Optional[DerivedMetricParams] = None,
    ) -> OndemandMetricSpec:
        # First we clean up the query from unnecessary filters.
        query = self._cleanup_query(query)

        # Second we process all the necessary components.
        op, metric_type, argument = self._process_field(field=field)
        rule_condition = self._process_query(field=field, query=query)
        tags_conditions = []

        # In case this is a derived metric, we also compute the list of tags conditions that will characterize the
        # metric.
        if (derived_metric := _DERIVED_METRICS.get(op)) is not None:
            if derived_metric_params is None:
                derived_metric_params = DerivedMetricParams.empty()

            if argument is not None:
                self._extend_derived_metric_params(
                    op=op, argument=argument, derived_metric_params=derived_metric_params
                )

                # For now if we have an argument for a derived metric, it implies it is the argument for apdex(x) thus
                # we want to scrape it, since Relay will not need that. However, we need to better define this behavior
                # since right now it's very hacky.
                argument = None

            tags_conditions = self._process_components(
                derived_metric=derived_metric, derived_metric_params=derived_metric_params
            )

        # Third we build the actual spec.
        return OndemandMetricSpec(
            op=op,
            metric_type=metric_type,
            field=argument,
            condition=rule_condition,
            tags_conditions=tags_conditions,
            original_query=query,
        )

    def _process_field(self, field: str) -> Tuple[MetricOperationType, str, Optional[str]]:
        parsed_field = self._field_parser.parse(field)
        if parsed_field is None:
            raise Exception(f"Unable to parse the field {field}")

        op = self._get_op(parsed_field.function)
        metric_type = self._get_metric_type(parsed_field.function)

        return op, metric_type, self._parse_argument(op, metric_type, parsed_field)

    def _process_query(self, field: str, query: str) -> RuleCondition:
        parsed_field = self._field_parser.parse(field)
        if parsed_field is None:
            raise Exception(f"Unable to parse the field {field}")

        # We have to handle the special case for the "count_if" function, however it may be better to build some
        # better abstracted code to handle third-party rule conditions injection.
        count_if_rule_condition = None
        if parsed_field.function == "count_if":
            key, op, value = parsed_field.arguments
            count_if_rule_condition = _convert_countif_filter(key, op, value)

        # First step is to parse the query string into our internal AST format.
        parsed_query = self._query_parser.parse(query)
        # An on demand metric must have at least a condition, otherwise we can just use a classic metric.
        if parsed_query is None or len(parsed_query.conditions) == 0:
            if count_if_rule_condition is None:
                raise Exception("This query should not use on demand metrics")

            return count_if_rule_condition

        # Second step is to generate the actual Relay rule that contains all rules nested.
        rule_condition = SearchQueryConverter(parsed_query.conditions, {}).convert()
        if not count_if_rule_condition:
            return rule_condition

        # In case we have a top level rule which is not an "and" we have to wrap it.
        if rule_condition["op"] != "and":
            return {"op": "and", "inner": [rule_condition, count_if_rule_condition]}

        # In the other case, we can just flatten the conditions.
        rule_condition["inner"].append(count_if_rule_condition)
        return rule_condition

    @staticmethod
    def _process_components(
        derived_metric: DerivedMetric, derived_metric_params: DerivedMetricParams
    ) -> List[TagSpec]:
        tags_conditions: List[TagSpec] = []
        for component in derived_metric.get_components(derived_metric_params):
            tags_conditions.append(
                {
                    "key": component.tag_key,
                    "value": component.tag_value,
                    "condition": component.condition,
                }
            )

        return tags_conditions

    @staticmethod
    def _parse_argument(
        op: MetricOperationType, metric_type: str, parsed_field: FieldParsingResult
    ) -> Optional[str]:
        requires_single_argument = metric_type in ["s", "d"] or op in ["on_demand_apdex"]
        if not requires_single_argument:
            return None

        if len(parsed_field.arguments) != 1:
            raise Exception(f"The operation {op} supports only a single parameter")

        argument = parsed_field.arguments[0]
        map_argument = op not in ["on_demand_apdex"]

        return _map_field_name(argument) if map_argument else argument

    @staticmethod
    def _extend_derived_metric_params(
        op: MetricOperationType, argument: str, derived_metric_params: DerivedMetricParams
    ):
        if op == "on_demand_apdex":
            derived_metric_params.add_param("apdex_threshold", int(argument))

    @staticmethod
    def _get_op(function: str) -> MetricOperationType:
        op = _SEARCH_TO_METRIC_AGGREGATES.get(function)
        if op is not None:
            return op

        raise Exception(f"Unsupported aggregate function {function}")

    @staticmethod
    def _get_metric_type(function: str) -> str:
        metric_type = _AGGREGATE_TO_METRIC_TYPE.get(function)
        if metric_type is not None:
            return metric_type

        raise Exception(f"Unsupported aggregate function {function}")

    @staticmethod
    def _cleanup_query(query: str) -> str:
        regexes = [r"event\.type:transaction\s*", r"project:[\w\"]+\s*"]

        new_query = query
        for regex in regexes:
            new_query = re.sub(regex, "", new_query)

        return new_query


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
    <<<<<<< HEAD
        Maps the name of a field in a search query to the event protocol path.
    =======
        Maps a name of a field in a search query to the event protocol path.
    >>>>>>> master

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


def _get_derived_metric_params(project: Project, field: str) -> DerivedMetricParams:
    if field.startswith("apdex"):
        result = ProjectTransactionThreshold.filter(
            organization_id=project.organization.id,
            project_ids=[project.id],
            order_by=[],
            value_list=["threshold", "metric"],
        )

        # We expect to find only 1 entry, if we find many or none, we throw an error.
        if len(result) == 0:
            raise Exception(f"No apdex threshold found for apdex in project {project.id}")
        elif len(result) > 1:
            raise Exception(f"Multiple thresholds found for apdex in project {project.id}")

        # We will extract the threshold from the apdex(x) field where x is the threshold.
        _threshold, metric = result[0]
        metric_op = TRANSACTION_METRICS[metric]

        return DerivedMetricParams({"field_to_extract": f"transaction.{metric_op}"})

    return DerivedMetricParams.empty()


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

        # We propagate the filter in order to give as output a better error message with more context.
        key: str = self._eval_search_key(token.key)
        value: Any = self._eval_search_value(token.value)
        if operator == "eq" and token.value.is_wildcard():
            condition: RuleCondition = {
                "op": "glob",
                "name": _map_field_name(key),
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
                "name": _map_field_name(key),
                "value": value,
            }

        # In case we have negation operators, we have to wrap them in the `not` condition.
        if token.operator == "!=" or token.operator == "NOT IN":
            condition = {"op": "not", "inner": condition}

        return condition

    @staticmethod
    def _eval_search_key(
        search_key: SearchKey,
    ) -> str:
        return search_key.name

    @staticmethod
    def _eval_search_value(search_value: SearchValue) -> Any:
        return search_value.raw_value
