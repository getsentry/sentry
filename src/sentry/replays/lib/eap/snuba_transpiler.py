"""
███████╗████████╗ ██████╗ ██████╗
██╔════╝╚══██╔══╝██╔═══██╗██╔══██╗
███████╗   ██║   ██║   ██║██████╔╝
╚════██║   ██║   ██║   ██║██╔═══╝
███████║   ██║   ╚██████╔╝██║
╚══════╝   ╚═╝    ╚═════╝ ╚═╝

Do not use any of these functions. They are private and subject to change.

This module contains a translation layer from Snuba SDK to the EAP protocol buffers format. You do
not need to call any of the functions contained within this module to query EAP or use the
translation layer.

This module does not consider aliasing. If you have a query which contains aliases you must
normalize it first.
"""

from collections.abc import MutableMapping, Sequence
from datetime import date, datetime
from typing import Any
from typing import Literal as TLiteral
from typing import NotRequired, Required, TypedDict, cast

import urllib3
from django.conf import settings
from google.protobuf.timestamp_pb2 import Timestamp
from rest_framework.exceptions import NotFound
from sentry_protos.snuba.v1.attribute_conditional_aggregation_pb2 import (
    AttributeConditionalAggregation,
)
from sentry_protos.snuba.v1.downsampled_storage_pb2 import DownsampledStorageConfig
from sentry_protos.snuba.v1.endpoint_trace_item_table_pb2 import (
    AggregationAndFilter,
    AggregationComparisonFilter,
    AggregationFilter,
    AggregationOrFilter,
)
from sentry_protos.snuba.v1.endpoint_trace_item_table_pb2 import Column as EAPColumn
from sentry_protos.snuba.v1.endpoint_trace_item_table_pb2 import (
    TraceItemTableRequest,
    TraceItemTableResponse,
)
from sentry_protos.snuba.v1.error_pb2 import Error as ErrorProto
from sentry_protos.snuba.v1.formula_pb2 import Literal
from sentry_protos.snuba.v1.request_common_pb2 import PageToken
from sentry_protos.snuba.v1.request_common_pb2 import RequestMeta as EAPRequestMeta
from sentry_protos.snuba.v1.request_common_pb2 import TraceItemType
from sentry_protos.snuba.v1.trace_item_attribute_pb2 import (
    AttributeAggregation,
    AttributeKey,
    AttributeValue,
    DoubleArray,
    ExtrapolationMode,
)
from sentry_protos.snuba.v1.trace_item_attribute_pb2 import Function as EAPFunction
from sentry_protos.snuba.v1.trace_item_attribute_pb2 import IntArray, StrArray, VirtualColumnContext
from sentry_protos.snuba.v1.trace_item_filter_pb2 import (
    AndFilter,
    ComparisonFilter,
    ExistsFilter,
    NotFilter,
    OrFilter,
    TraceItemFilter,
)
from snuba_sdk import (
    AliasedExpression,
    BooleanCondition,
    BooleanOp,
    Column,
    Condition,
    CurriedFunction,
    Function,
    Op,
    Query,
)
from snuba_sdk.expressions import ScalarType
from snuba_sdk.orderby import Direction, OrderBy

from sentry.net.http import connection_from_url
from sentry.utils import json
from sentry.utils.snuba import RetrySkipTimeout
from sentry.utils.snuba_rpc import SnubaRPCError

ARITHMETIC_FUNCTION_MAP: dict[str, EAPColumn.BinaryFormula.Op.ValueType] = {
    "divide": EAPColumn.BinaryFormula.OP_DIVIDE,
    "minus": EAPColumn.BinaryFormula.OP_SUBTRACT,
    "multiply": EAPColumn.BinaryFormula.OP_MULTIPLY,
    "plus": EAPColumn.BinaryFormula.OP_ADD,
}

FUNCTION_MAP = {
    "avg": EAPFunction.FUNCTION_AVG,
    "count": EAPFunction.FUNCTION_COUNT,
    "max": EAPFunction.FUNCTION_MAX,
    "min": EAPFunction.FUNCTION_MIN,
    "p50": EAPFunction.FUNCTION_P50,
    "p75": EAPFunction.FUNCTION_P75,
    "p90": EAPFunction.FUNCTION_P90,
    "p95": EAPFunction.FUNCTION_P95,
    "p99": EAPFunction.FUNCTION_P99,
    "quantiles(0.5)": EAPFunction.FUNCTION_P50,
    "quantiles(0.75)": EAPFunction.FUNCTION_P75,
    "quantiles(0.90)": EAPFunction.FUNCTION_P90,
    "quantiles(0.95)": EAPFunction.FUNCTION_P95,
    "quantiles(0.99)": EAPFunction.FUNCTION_P99,
    "sum": EAPFunction.FUNCTION_SUM,
    "uniq": EAPFunction.FUNCTION_UNIQ,
}

CONDITIONAL_FUNCTION_MAP = {
    "avgIf": EAPFunction.FUNCTION_AVG,
    "countIf": EAPFunction.FUNCTION_COUNT,
    "maxIf": EAPFunction.FUNCTION_MAX,
    "minIf": EAPFunction.FUNCTION_MIN,
    "p50If": EAPFunction.FUNCTION_P50,
    "p75If": EAPFunction.FUNCTION_P75,
    "p90If": EAPFunction.FUNCTION_P90,
    "p95If": EAPFunction.FUNCTION_P95,
    "p99If": EAPFunction.FUNCTION_P99,
    "quantilesIf(0.5)": EAPFunction.FUNCTION_P50,
    "quantilesIf(0.75)": EAPFunction.FUNCTION_P75,
    "quantilesIf(0.90)": EAPFunction.FUNCTION_P90,
    "quantilesIf(0.95)": EAPFunction.FUNCTION_P95,
    "quantilesIf(0.99)": EAPFunction.FUNCTION_P99,
    "sumIf": EAPFunction.FUNCTION_SUM,
    "uniqIf": EAPFunction.FUNCTION_UNIQ,
}

AGGREGATION_OPERATOR_MAP = {
    Op.EQ: AggregationComparisonFilter.OP_EQUALS,
    Op.NEQ: AggregationComparisonFilter.OP_NOT_EQUALS,
    Op.GT: AggregationComparisonFilter.OP_GREATER_THAN,
    Op.LT: AggregationComparisonFilter.OP_LESS_THAN,
    Op.GTE: AggregationComparisonFilter.OP_GREATER_THAN_OR_EQUALS,
    Op.LTE: AggregationComparisonFilter.OP_LESS_THAN_OR_EQUALS,
}

AGGREGATION_FUNCTION_OPERATOR_MAP = {
    "equals": AggregationComparisonFilter.OP_EQUALS,
    "notEquals": AggregationComparisonFilter.OP_NOT_EQUALS,
    "greater": AggregationComparisonFilter.OP_GREATER_THAN,
    "less": AggregationComparisonFilter.OP_LESS_THAN,
    "greaterOrEquals": AggregationComparisonFilter.OP_GREATER_THAN_OR_EQUALS,
    "lessOrEquals": AggregationComparisonFilter.OP_LESS_THAN_OR_EQUALS,
}

OPERATOR_MAP = {
    Op.EQ: ComparisonFilter.OP_EQUALS,
    Op.NEQ: ComparisonFilter.OP_NOT_EQUALS,
    Op.IN: ComparisonFilter.OP_IN,
    Op.NOT_IN: ComparisonFilter.OP_NOT_IN,
    Op.GT: ComparisonFilter.OP_GREATER_THAN,
    Op.LT: ComparisonFilter.OP_LESS_THAN,
    Op.GTE: ComparisonFilter.OP_GREATER_THAN_OR_EQUALS,
    Op.LTE: ComparisonFilter.OP_LESS_THAN_OR_EQUALS,
    Op.LIKE: ComparisonFilter.OP_LIKE,
    Op.NOT_LIKE: ComparisonFilter.OP_NOT_LIKE,
}

FUNCTION_OPERATOR_MAP = {
    "equals": ComparisonFilter.OP_EQUALS,
    "notEquals": ComparisonFilter.OP_NOT_EQUALS,
    "in": ComparisonFilter.OP_IN,
    "notIn": ComparisonFilter.OP_NOT_IN,
    "greater": ComparisonFilter.OP_GREATER_THAN,
    "less": ComparisonFilter.OP_LESS_THAN,
    "greaterOrEquals": ComparisonFilter.OP_GREATER_THAN_OR_EQUALS,
    "lessOrEquals": ComparisonFilter.OP_LESS_THAN_OR_EQUALS,
    "like": ComparisonFilter.OP_LIKE,
    "notLike": ComparisonFilter.OP_NOT_LIKE,
}

TYPE_MAP = {
    bool: AttributeKey.TYPE_BOOLEAN,
    float: AttributeKey.TYPE_DOUBLE,
    int: AttributeKey.TYPE_INT,
    str: AttributeKey.TYPE_STRING,
}

EXTRAPOLATION_MODE_MAP = {
    "weighted": ExtrapolationMode.EXTRAPOLATION_MODE_SAMPLE_WEIGHTED,
    "none": ExtrapolationMode.EXTRAPOLATION_MODE_NONE,
}

TRACE_ITEM_TYPE_MAP = {
    "span": TraceItemType.TRACE_ITEM_TYPE_SPAN,
    "error": TraceItemType.TRACE_ITEM_TYPE_ERROR,
    "log": TraceItemType.TRACE_ITEM_TYPE_LOG,
    "uptime_result": TraceItemType.TRACE_ITEM_TYPE_UPTIME_RESULT,
    "replay": TraceItemType.TRACE_ITEM_TYPE_REPLAY,
    "metric": TraceItemType.TRACE_ITEM_TYPE_METRIC,
    "profile_functions": TraceItemType.TRACE_ITEM_TYPE_PROFILE_FUNCTION,
}

TRACE_ITEM_TYPES = TLiteral[
    "span", "error", "log", "uptime_result", "replay", "metric", "profile_functions"  # noqa
]


class RequestMeta(TypedDict):
    """
    Metadata for EAP requests.

    This TypedDict contains essential metadata that accompanies requests for
    trace data analysis, debugging, and monitoring operations. All fields are
    required and provide context for request processing, billing, and audit trails.

    Attributes:
        cogs_category: Cost category identifier for billing and resource allocation.

        debug: Flag indicating whether debug mode is enabled for this request. When used ensure
            the "translate_response" function is not being called on the response. Currently, it
            drops debug data. You'll need to interact with a raw EAP response.

        end_datetime: End timestamp for the time range being queried.
            Defines the upper bound of the window for data retrieval.
            Must be timezone-aware and later than start_datetime.

        organization_id: Unique identifier of the organization making the request.
            Used for access control, data isolation, and billing attribution.
            Must be a positive integer corresponding to an existing organization.

        project_ids: List of project identifiers to include in the query scope.
            Filters data to only include traces from the specified projects.
            All IDs must correspond to projects accessible by the organization.

        referrer: Identifier indicating the source or context of the request.
            Used for analytics, debugging, and understanding request patterns.
            Examples: "api.organization-events", "discover.query", "performance.summary"

        request_id: Unique identifier for this specific request instance.

        start_datetime: Start timestamp for the time range being queried.
            Defines the lower bound of the window for data retrieval.
            Must be timezone-aware and typically earlier than end_datetime.

        trace_item_type: Type of trace items to retrieve in this request.
            Determines what kind of observability data is being requested:
            - "span": Distributed tracing span data
            - "error": Error events
            - "log": Application log entries
            - "uptime_result": Processed uptime monitoring outcomes
            - "replay": Session replay events

    Example:
        Performance monitoring request:
        >>> request_meta: RequestMeta = {
        ...     "cogs_category": "performance",
        ...     "debug": False,
        ...     "end_datetime": datetime(2024, 1, 15, 23, 59, 59, tzinfo=timezone.utc),
        ...     "organization_id": 12345,
        ...     "project_ids": [67890, 67891],
        ...     "referrer": "performance.transaction_summary",
        ...     "request_id": "f288571e5c4a48ed881951dcb66800e5",
        ...     "start_datetime": datetime(2024, 1, 15, 0, 0, 0, tzinfo=timezone.utc),
        ...     "trace_item_type": "span"
        ... }

        Error analysis request:
        >>> error_request: RequestMeta = {
        ...     "cogs_category": "errors",
        ...     "debug": True,
        ...     "end_datetime": datetime(2024, 1, 16, 12, 0, 0, tzinfo=timezone.utc),
        ...     "organization_id": 54321,
        ...     "project_ids": [11111],
        ...     "referrer": "issues.details",
        ...     "request_id": "45bbcf4e8edf44919a71d5cb8c6bf376",
        ...     "start_datetime": datetime(2024, 1, 16, 11, 0, 0, tzinfo=timezone.utc),
        ...     "trace_item_type": "error"
        ... }
    """

    cogs_category: str
    debug: bool
    end_datetime: datetime
    organization_id: int
    project_ids: list[int]
    referrer: str
    request_id: str
    start_datetime: datetime
    trace_item_type: TRACE_ITEM_TYPES


class Settings(TypedDict, total=False):
    """
    Query settings are extra metadata items which are not representable within a Snuba query. They
    are not sent to EAP in the form they are supplied. Instead they are used as helper metadata in
    the construction of an EAP query.

    This type defines configuration parameters that extend beyond what the
    Snuba SDK can natively express. Every field is optional with the exception of the
    "attribute_types" field which is required and if its omitted an error will be raised during
    query processing.

    Attributes:
        attribute_types: Mapping of attribute names to their type in EAP.
            Keys are attribute identifiers (strings), values are type objects
            for basic Python types (bool, float, int, str). Used for routing the
            attribute name to the correct value bucket in EAP.

        default_limit: Default number of records to return when no explicit
            limit is specified in the query.

        default_offset: Default number of records to skip when no explicit
            offset is specified in the query.

        extrapolation_modes: Strategy for handling data extrapolation in queries.
            Maps names to extrapolation modes.
            - "weighted": Apply weighted extrapolation algorithms to estimate
              missing data points based on existing patterns
            - "none": Disable extrapolation, return only actual data points
              without any estimation or interpolation

    Example:
        Basic configuration with type validation:
        >>> settings: Settings = {
        ...     "attribute_types": {
        ...         "user_id": int,
        ...         "score": float,
        ...         "is_active": bool,
        ...         "username": str
        ...     },
        ...     "default_limit": 100,
        ...     "default_offset": 0,
        ...     "extrapolation_modes": {"sum(score)": "weighted"}
        ... }

        Minimal configuration (all fields but "attribute_types" are optional):
        >>> minimal_settings: Settings = {
        ...     "attribute_types": {
        ...         "user_id": int,
        ...         "score": float,
        ...         "is_active": bool,
        ...         "username": str
        ...     },
        ... }
    """

    attribute_types: Required[dict[str, type[bool | float | int | str]]]
    default_limit: int
    default_offset: int
    extrapolation_modes: MutableMapping[str, TLiteral["weighted", "none"]]  # noqa


VirtualColumn = TypedDict(
    "VirtualColumn",
    {
        "from": str,
        "to": str,
        "value_map": dict[str, str],
        "default_value": NotRequired[str],
    },
)
"""
A virtual column defines translation instructions for mapping data inside EAP to data outside of
EAP.

This TypedDict models a virtual column that maps values from an existing
column to new values, allowing for user-friendly column names and values
that may not be stored directly in the database.

Example:
    For a scenario where `project_name` is changeable by the user and not
    stored in EAP, but sorting by it is desired:

    ```python
    >>> virtual_column: VirtualColumn = {
    ...     "from": "sentry.project_id",
    ...     "to": "sentry.project_name",
    ...     "value_map": {"1": "sentry", "2": "snuba"},
    ...     "default_value": "unknown"
    ... }
    ```

    In this example, `sentry.project_name` is a virtual column created by
    mapping values from the real column `sentry.project_id`. A project_id
    of "1" gets mapped to project_name="sentry", etc.

Attributes:
    from: The name of the source column containing the original values
    to: The name of the virtual column to be created
    value_map: Dictionary mapping original column values to new virtual column values
    default_value: Optional default value to use when no mapping exists for a given value
"""


def execute_query(request: TraceItemTableRequest, referrer: str):
    request_method = "POST"
    request_body = request.SerializeToString()
    request_url = "/rpc/EndpointTraceItemTable/v1"
    request_headers = {"referer": referrer}

    try:
        _snuba_pool = connection_from_url(
            settings.SENTRY_SNUBA,
            retries=RetrySkipTimeout(
                total=5,
                # Our calls to snuba frequently fail due to network issues. We want to
                # automatically retry most requests. Some of our POSTs and all of our DELETEs
                # do cause mutations, but we have other things in place to handle duplicate
                # mutations.
                allowed_methods={"GET", "POST", "DELETE"},
            ),
            timeout=settings.SENTRY_SNUBA_TIMEOUT,
            maxsize=10,
        )

        http_resp = _snuba_pool.urlopen(
            method=request_method,
            url=request_url,
            body=request_body,
            headers=request_headers,
        )
    except urllib3.exceptions.HTTPError as err:
        raise SnubaRPCError(err)

    if http_resp.status >= 400:
        error = ErrorProto()
        error.ParseFromString(http_resp.data)
        if http_resp.status == 404:
            raise NotFound() from SnubaRPCError(error)
        else:
            raise SnubaRPCError(error)

    response = TraceItemTableResponse()
    response.ParseFromString(http_resp.data)
    return response


def as_eap_request(
    query: Query, meta: RequestMeta, settings: Settings, virtual_columns: list[VirtualColumn]
) -> TraceItemTableRequest:
    start_timestamp = Timestamp()
    start_timestamp.FromDatetime(meta["start_datetime"])

    end_timestamp = Timestamp()
    end_timestamp.FromDatetime(meta["end_datetime"])

    return TraceItemTableRequest(
        columns=select(query.select, settings),
        filter=where(query.where, settings),
        aggregation_filter=having(query.having, settings),
        group_by=groupby(query.groupby, settings),
        order_by=orderby(query.orderby, settings),
        limit=query.limit.limit if query.limit else settings.get("default_limit", 25),
        page_token=PageToken(
            offset=query.offset.offset if query.offset else settings.get("default_offset", 0)
        ),
        virtual_column_contexts=[
            VirtualColumnContext(
                from_column_name=vc["from"],
                to_column_name=vc["to"],
                value_map=vc["value_map"],
                default_value=vc.get("default_value", ""),
            )
            for vc in virtual_columns
        ],
        meta=EAPRequestMeta(
            cogs_category=meta["cogs_category"],
            debug=meta["debug"],
            end_timestamp=end_timestamp,
            organization_id=meta["organization_id"],
            project_ids=meta["project_ids"],
            referrer=meta["referrer"],
            request_id=meta["request_id"],
            start_timestamp=start_timestamp,
            trace_item_type=TRACE_ITEM_TYPE_MAP[meta["trace_item_type"]],
            downsampled_storage_config=DownsampledStorageConfig(
                mode=DownsampledStorageConfig.MODE_BEST_EFFORT
            ),
        ),
    )


def select(
    exprs: list[AliasedExpression | Column | CurriedFunction | Function] | None,
    settings: Settings,
) -> list[EAPColumn] | None:
    if exprs is None:
        return None

    return [expression(expr, settings) for expr in exprs]


def where(
    conditions: list[BooleanCondition | Condition] | None,
    settings: Settings,
) -> TraceItemFilter | None:
    if not conditions:
        return None

    return TraceItemFilter(
        and_filter=AndFilter(filters=[condition(c, settings) for c in conditions])
    )


def having(
    conditions: list[BooleanCondition | Condition] | None,
    settings: Settings,
) -> AggregationFilter | None:
    if not conditions:
        return None

    return AggregationFilter(
        and_filter=AggregationAndFilter(filters=[agg_condition(c, settings) for c in conditions])
    )


def orderby(
    orderby: Sequence[OrderBy] | None,
    settings: Settings,
) -> list[TraceItemTableRequest.OrderBy] | None:
    if not orderby:
        return None

    return [
        TraceItemTableRequest.OrderBy(
            column=expression(o.exp, settings), descending=o.direction == Direction.DESC
        )
        for o in orderby
    ]


def groupby(
    columns: list[AliasedExpression | Column | CurriedFunction | Function] | None,
    settings: Settings,
) -> list[AttributeKey] | None:
    if not columns:
        return None

    if not all(isinstance(c, Column) for c in columns):
        raise TypeError("Only column types are permitted in the group by clause")

    return [key(column, settings) for column in columns]


def condition(expr: BooleanCondition | Condition, settings: Settings) -> TraceItemFilter:
    if isinstance(expr, BooleanCondition):
        filters = [condition(c, settings) for c in expr.conditions]
        if expr.op == BooleanOp.AND:
            return TraceItemFilter(and_filter=AndFilter(filters=filters))
        else:
            return TraceItemFilter(or_filter=OrFilter(filters=filters))

    if isinstance(expr.lhs, (CurriedFunction, Function)):
        assert expr.op == Op.EQ, "Dropped operator must be equals"
        assert expr.rhs == 1, "Dropped right hand expression must be one"
        return function_to_filter(expr.lhs, settings)
    else:
        return TraceItemFilter(
            comparison_filter=ComparisonFilter(
                key=key(expr.lhs, settings),
                op=operator(expr.op),
                value=literal(expr.rhs),
            )
        )


def function_to_filter(expr: Any, settings: Settings) -> TraceItemFilter:
    if not isinstance(expr, Function):
        raise TypeError("Invalid nested expression specified. Expected function", expr)

    if expr.function == "and":
        filters = [function_to_filter(p, settings) for p in expr.parameters]
        return TraceItemFilter(and_filter=AndFilter(filters=filters))
    elif expr.function == "or":
        filters = [function_to_filter(p, settings) for p in expr.parameters]
        return TraceItemFilter(or_filter=OrFilter(filters=filters))
    elif expr.function == "exists":
        assert len(expr.parameters) == 1, "Expected single parameter to exists function"
        return TraceItemFilter(exists_filter=ExistsFilter(key=key(expr.parameters[0], settings)))
    elif expr.function == "not":
        filters = [function_to_filter(p, settings) for p in expr.parameters]
        return TraceItemFilter(
            not_filter=NotFilter(filters=[TraceItemFilter(and_filter=AndFilter(filters=filters))])
        )
    elif expr.function in FUNCTION_OPERATOR_MAP:
        assert len(expr.parameters) == 2, "Invalid number of parameters for binary expression"
        return TraceItemFilter(
            comparison_filter=ComparisonFilter(
                key=key(expr.parameters[0], settings),
                op=FUNCTION_OPERATOR_MAP[expr.function],
                value=literal(expr.parameters[1]),
            )
        )
    else:
        raise ValueError("Unsupported expr specified", expr)


def agg_condition(expr: BooleanCondition | Condition, settings: Settings) -> AggregationFilter:
    if isinstance(expr, BooleanCondition):
        filters = [agg_condition(c, settings) for c in expr.conditions]
        if expr.op == BooleanOp.AND:
            return AggregationFilter(and_filter=AggregationAndFilter(filters=filters))
        else:
            return AggregationFilter(or_filter=AggregationOrFilter(filters=filters))

    if isinstance(expr.lhs, (CurriedFunction, Function)):
        if expr.lhs.function == "and":
            filters = [agg_function_to_filter(p, settings) for p in expr.lhs.parameters]
            return AggregationFilter(and_filter=AggregationAndFilter(filters=filters))
        elif expr.lhs.function == "or":
            filters = [agg_function_to_filter(p, settings) for p in expr.lhs.parameters]
            return AggregationFilter(or_filter=AggregationOrFilter(filters=filters))
        elif expr.lhs.function in FUNCTION_MAP:
            assert len(expr.lhs.parameters) == 1, "Expected one parameter to aggregate function"
            return AggregationFilter(
                comparison_filter=AggregationComparisonFilter(
                    op=aggregate_operator(expr.op),
                    val=float(expr.rhs),
                    aggregation=AttributeAggregation(
                        aggregate=FUNCTION_MAP[expr.lhs.function],
                        key=key(expr.lhs.parameters[0], settings),
                        extrapolation_mode=extrapolation_mode(label(expr.lhs), settings),
                    ),
                )
            )
        elif expr.lhs.function in CONDITIONAL_FUNCTION_MAP:
            assert len(expr.lhs.parameters) == 2, "Expected two parameters to conditional aggregate"
            return AggregationFilter(
                comparison_filter=AggregationComparisonFilter(
                    op=aggregate_operator(expr.op),
                    val=float(expr.rhs),
                    conditional_aggregation=AttributeConditionalAggregation(
                        aggregate=CONDITIONAL_FUNCTION_MAP[expr.lhs.function],
                        key=key(expr.lhs.parameters[0], settings),
                        extrapolation_mode=extrapolation_mode(label(expr.lhs), settings),
                        filter=condidtional_aggregation_filter(expr.lhs.parameters[1], settings),
                    ),
                )
            )
        else:
            raise ValueError("Unsupported aggregation function specified", expr)
    else:
        raise ValueError("Expected aggregation function", expr)


def agg_function_to_filter(expr: Any, settings: Settings) -> AggregationFilter:
    assert isinstance(expr, (CurriedFunction, Function)), "Expected function"

    if expr.function == "and":
        filters = [agg_function_to_filter(p, settings) for p in expr.parameters]
        return AggregationFilter(and_filter=AggregationAndFilter(filters=filters))
    elif expr.function == "or":
        filters = [agg_function_to_filter(p, settings) for p in expr.parameters]
        return AggregationFilter(or_filter=AggregationOrFilter(filters=filters))
    elif expr.function in AGGREGATION_FUNCTION_OPERATOR_MAP:
        assert len(expr.parameters) == 2, "Expected two parameters to binary expression"

        nested_fn = expr.parameters[0]
        assert isinstance(nested_fn, (CurriedFunction, Function)), "Expected aggregate function"

        return AggregationFilter(
            comparison_filter=AggregationComparisonFilter(
                op=AGGREGATION_FUNCTION_OPERATOR_MAP[expr.function],
                val=float(expr.parameters[1]),
                aggregation=AttributeAggregation(
                    aggregate=FUNCTION_MAP[nested_fn.function],
                    key=key(nested_fn.parameters[0], settings),
                    extrapolation_mode=extrapolation_mode(label(expr), settings),
                ),
            )
        )
    else:
        raise TypeError("Invalid function specified", expr)


def expression(
    expr: AliasedExpression | Column | CurriedFunction | Function, settings: Settings
) -> EAPColumn:
    if isinstance(expr, Column):
        return EAPColumn(key=key(expr, settings), label=expr.name)
    elif isinstance(expr, AliasedExpression):
        return EAPColumn(key=key(expr.exp, settings), label=expr.alias)
    elif isinstance(expr, (CurriedFunction, Function)):
        if expr.function in ARITHMETIC_FUNCTION_MAP:
            return EAPColumn(
                formula=EAPColumn.BinaryFormula(
                    op=ARITHMETIC_FUNCTION_MAP[expr.function],
                    left=expression(expr.parameters[0], settings),
                    right=expression(expr.parameters[1], settings),
                )
            )
        elif expr.function in FUNCTION_MAP:
            return EAPColumn(
                aggregation=AttributeAggregation(
                    aggregate=FUNCTION_MAP[expr.function],
                    key=key(expr.parameters[0], settings),
                    extrapolation_mode=extrapolation_mode(label(expr), settings),
                    label=label(expr),
                ),
                label=label(expr),
            )
        elif expr.function in CONDITIONAL_FUNCTION_MAP:
            return EAPColumn(
                conditional_aggregation=AttributeConditionalAggregation(
                    aggregate=CONDITIONAL_FUNCTION_MAP[expr.function],
                    key=key(expr.parameters[0], settings),
                    extrapolation_mode=extrapolation_mode(label(expr), settings),
                    filter=condidtional_aggregation_filter(expr.parameters[1], settings),
                    label=label(expr),
                ),
                label=label(expr),
            )
        else:
            raise ValueError("Unsupported function specified", expr)
    elif isinstance(expr, (float, int)):
        return EAPColumn(literal=Literal(val_double=float(expr)))
    else:
        raise TypeError("Invalid expression type specified", expr)


def condidtional_aggregation_filter(expr: Any, settings: Settings) -> TraceItemFilter:
    if not isinstance(expr, Function):
        raise TypeError("Invalid function for conditional aggregation")

    return TraceItemFilter(
        comparison_filter=ComparisonFilter(
            key=key(expr.parameters[0], settings),
            op=FUNCTION_OPERATOR_MAP[expr.function],
            value=literal(expr.parameters[1]),
        )
    )


def literal(value: Any) -> AttributeValue:
    match value:
        case bool():
            return AttributeValue(val_bool=value)
        case float():
            return AttributeValue(val_double=value)
        case int():
            return AttributeValue(val_int=value)
        case str():
            return AttributeValue(val_str=value)
        case None:
            return AttributeValue(is_null=True)
        case list():
            if not value:
                raise ValueError("List is empty.")

            allowed_types = float, int, str
            if not all(isinstance(item, allowed_types) for item in value):
                raise ValueError("Invalid type specified in value array", value)

            typ_ = type(value[0])
            if not all(isinstance(item, typ_) for item in value):
                raise ValueError("Heterogenous list specified", value)

            if isinstance(value[0], float):
                return AttributeValue(val_double_array=DoubleArray(values=cast(list[float], value)))
            elif isinstance(value[0], int):
                return AttributeValue(val_int_array=IntArray(values=cast(list[int], value)))
            else:
                return AttributeValue(val_str_array=StrArray(values=cast(list[str], value)))
        case _:
            raise TypeError("Invalid literal specified", value)


def key(column: Any, settings: Settings) -> AttributeKey:
    assert isinstance(column, Column), "Expected column"
    return AttributeKey(type=TYPE_MAP[settings["attribute_types"][column.name]], name=column.name)


def operator(op: Op) -> ComparisonFilter.Op.ValueType:
    try:
        return OPERATOR_MAP[op]
    except KeyError:
        raise ValueError("Invalid operator specified", op)


def aggregate_operator(op: Op) -> AggregationComparisonFilter.Op.ValueType:
    try:
        return AGGREGATION_OPERATOR_MAP[op]
    except KeyError:
        raise ValueError("Invalid aggregate operator specified", op)


def label(expr: Column | CurriedFunction | Function | ScalarType) -> str:
    if isinstance(expr, Column):
        return expr.name
    elif isinstance(expr, (CurriedFunction, Function)):
        if expr.alias:
            return expr.alias
        else:
            return f'{expr.function}({", ".join(label(p) for p in expr.parameters)})'
    elif isinstance(expr, (date, datetime)):
        return expr.isoformat()
    elif isinstance(expr, (list, tuple, Sequence)):
        return f"[{", ".join(label(item) for item in expr)}]"
    elif isinstance(expr, (bytes, bytearray, memoryview)):
        return str(expr)
    else:
        return json.dumps(expr)


def extrapolation_mode(label: str, settings: Settings) -> ExtrapolationMode.ValueType:
    modes = settings.get("extrapolation_modes", {})
    return EXTRAPOLATION_MODE_MAP[modes.get(label, "none")]


class QueryResultMetaDownsamplingMode(TypedDict):
    can_go_to_higher_accuracy: bool
    estimated_rows: int


class QueryResultMeta(TypedDict):

    downsampling_mode: QueryResultMetaDownsamplingMode
    next_offset: int
    request_id: str


class QueryResult(TypedDict):

    data: list[dict[str, bool | float | int | str | None]]
    meta: QueryResultMeta


def translate_response(
    query: Query, settings: Settings, query_result: TraceItemTableResponse
) -> QueryResult:
    # We infer the type of each expression in the select statement. The type information is used
    # to extract the value from the response object.
    type_map = {label(expr): type_infer(expr, settings) for expr in query.select}

    def get_value(name: str, result: AttributeValue) -> bool | float | int | str | None:
        """Return the query result's value using type inference."""
        if result.is_null:
            return None

        typ_ = type_map[name]
        if typ_ == bool:
            return result.val_bool
        if typ_ == float:
            return result.val_double
        if typ_ == int:
            return result.val_int
        if typ_ == str:
            return result.val_str
        else:
            return None

    if len(query_result.column_values) > 0:
        data_len = len(query_result.column_values[0].results)
    else:
        data_len = 0

    response: QueryResult = {
        "data": [{} for _ in range(data_len)],
        "meta": {
            "downsampling_mode": {
                "can_go_to_higher_accuracy": query_result.meta.downsampled_storage_meta.can_go_to_higher_accuracy_tier,
                "estimated_rows": query_result.meta.downsampled_storage_meta.estimated_num_rows,
            },
            "next_offset": query_result.page_token.offset,
            "request_id": query_result.meta.request_id,
        },
    }

    # I'm assuming that all the columns return an identical number of results. As far as I know
    # this is a safe assumption.
    for c in query_result.column_values:
        for i, result in enumerate(c.results):
            response["data"][i][c.attribute_name] = get_value(c.attribute_name, result)

    return response


def type_infer(
    expression: AliasedExpression | Column | CurriedFunction | Function, settings: Settings
) -> type[bool | float | int | str]:
    """Infer the type of the expression."""
    if isinstance(expression, Column):
        return settings["attribute_types"][expression.name]
    elif isinstance(expression, AliasedExpression):
        return settings["attribute_types"][expression.exp.name]
    else:
        return float
