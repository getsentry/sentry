from typing import Callable, cast

from sentry_protos.snuba.v1.attribute_conditional_aggregation_pb2 import (
    AttributeConditionalAggregation,
)
from sentry_protos.snuba.v1.endpoint_trace_item_table_pb2 import Column
from sentry_protos.snuba.v1.formula_pb2 import Literal as LiteralValue
from sentry_protos.snuba.v1.trace_item_attribute_pb2 import (
    AttributeAggregation,
    AttributeKey,
    Function,
)
from sentry_protos.snuba.v1.trace_item_filter_pb2 import AndFilter, TraceItemFilter

from sentry.exceptions import InvalidSearchQuery
from sentry.search.eap.columns import (
    AttributeArgumentDefinition,
    ConditionalTraceMetricFormulaDefinition,
    FormulaDefinition,
    MultiTraceMetricFormulaDefinition,
    ResolvedArguments,
    ResolverSettings,
    TraceMetricFormulaDefinition,
    ValueArgumentDefinition,
    extract_trace_metric_aggregate_arguments,
)
from sentry.search.eap.spans.utils import operate_multiple_columns
from sentry.search.eap.trace_metrics.config import TraceMetricsSearchResolverConfig
from sentry.search.eap.trace_metrics.types import TraceMetric
from sentry.search.eap.validator import literal_validator
from sentry.search.events.constants import WEB_VITALS_PERFORMANCE_SCORE_WEIGHTS


def _rate_internal(
    divisor: int, args: ResolvedArguments, settings: ResolverSettings
) -> Column.BinaryFormula:
    """
    Calculate rate per X for trace metrics using the value attribute.
    """
    search_config = settings["search_config"]
    if not isinstance(search_config, TraceMetricsSearchResolverConfig):
        raise InvalidSearchQuery("unexpected search config")

    extrapolation_mode = settings["extrapolation_mode"]
    is_timeseries_request = settings["snuba_params"].is_timeseries_request

    time_interval = (
        settings["snuba_params"].timeseries_granularity_secs
        if is_timeseries_request
        else settings["snuba_params"].interval
    )

    trace_metric = search_config.metric or extract_trace_metric_aggregate_arguments(
        args, offset=0 if not settings["conditional"] else 1
    )

    trace_filter: TraceItemFilter | None
    if trace_metric is not None:
        trace_filter = (
            TraceItemFilter(
                and_filter=AndFilter(
                    filters=[cast(TraceItemFilter, args[0]), trace_metric.get_filter()]
                )
            )
            if settings["conditional"]
            else trace_metric.get_filter()
        )
        if trace_metric.metric_type == "counter":
            aggregate = Function.FUNCTION_SUM
            key = AttributeKey(type=AttributeKey.TYPE_DOUBLE, name="sentry.value")
        else:
            aggregate = Function.FUNCTION_COUNT
            key = AttributeKey(name="sentry.project_id", type=AttributeKey.Type.TYPE_INT)
    else:
        if settings["conditional"]:
            trace_filter = cast(TraceItemFilter, args[0])
        else:
            trace_filter = None
        aggregate = Function.FUNCTION_COUNT
        key = AttributeKey(name="sentry.project_id", type=AttributeKey.Type.TYPE_INT)

    if trace_filter is None:
        left = Column(
            aggregation=AttributeAggregation(
                aggregate=Function.FUNCTION_COUNT,
                key=key,
                extrapolation_mode=extrapolation_mode,
            )
        )
    else:
        left = Column(
            conditional_aggregation=AttributeConditionalAggregation(
                aggregate=aggregate,
                key=key,
                filter=trace_filter,
                extrapolation_mode=extrapolation_mode,
            )
        )

    return Column.BinaryFormula(
        left=left,
        op=Column.BinaryFormula.OP_DIVIDE,
        right=Column(
            literal=LiteralValue(val_double=time_interval / divisor),
        ),
    )


def per_second(args: ResolvedArguments, settings: ResolverSettings) -> Column.BinaryFormula:
    """
    Calculate rate per second for trace metrics using the value attribute.
    """
    return _rate_internal(1, args, settings)


def per_minute(args: ResolvedArguments, settings: ResolverSettings) -> Column.BinaryFormula:
    """
    Calculate rate per minute for trace metrics using the value attribute.
    """
    return _rate_internal(60, args, settings)


WEB_VITALS = ["lcp", "fcp", "cls", "ttfb", "inp"]

WEB_VITAL_SCORE_METRICS: dict[str, TraceMetric] = {
    vital: TraceMetric(
        metric_name=f"browser.web_vital.{vital}.score",
        metric_type="distribution",
        metric_unit="ratio",
    )
    for vital in WEB_VITALS
}

VALUE_KEY = AttributeKey(name="sentry.value", type=AttributeKey.TYPE_DOUBLE)

TOTAL_SCORE_COUNTS_CACHE_KEY = "trace_metrics_total_score_counts"


def _score_count_column(vital: str) -> str:
    return f"count(value,browser.web_vital.{vital}.score,distribution,ratio)"


def _score_aggregate(
    aggregate: Function.ValueType, vital: str, settings: ResolverSettings
) -> Column:
    return Column(
        conditional_aggregation=AttributeConditionalAggregation(
            aggregate=aggregate,
            key=VALUE_KEY,
            filter=WEB_VITAL_SCORE_METRICS[vital].get_filter(),
            extrapolation_mode=settings["extrapolation_mode"],
        )
    )


def _formula_with_default_zero(
    left: Column, op: Column.BinaryFormula.Op.ValueType, right: Column
) -> Column:
    return Column(
        formula=Column.BinaryFormula(default_value_double=0.0, left=left, op=op, right=right)
    )


def _weighted(column: Column, weight: float) -> Column:
    return _formula_with_default_zero(
        column, Column.BinaryFormula.OP_MULTIPLY, Column(literal=LiteralValue(val_double=weight))
    )


def _has_data(vital: str, settings: ResolverSettings) -> Column:
    # count / count is 1.0 and nulls out to 0.0 if there are no rows.
    count = _score_aggregate(Function.FUNCTION_COUNT, vital, settings)
    return _formula_with_default_zero(count, Column.BinaryFormula.OP_DIVIDE, count)


def none_if_zero_processor(value: float) -> float | None:
    if value == 0:
        return None
    return value


def performance_score(_: ResolvedArguments, settings: ResolverSettings) -> Column.BinaryFormula:
    """
    Sum of weighted averages of the per-vital scores, where only vitals with data contribute their weight.
    """
    weighted_scores: list[Column] = []
    weights: list[Column] = []

    for vital in WEB_VITALS:
        weight = WEB_VITALS_PERFORMANCE_SCORE_WEIGHTS[vital]
        avg = _score_aggregate(Function.FUNCTION_AVG, vital, settings)
        weighted_scores.append(_weighted(avg, weight))
        weights.append(_weighted(_has_data(vital, settings), weight))

    return Column.BinaryFormula(
        default_value_double=0.0,
        left=Column(formula=operate_multiple_columns(weighted_scores, Column.BinaryFormula.OP_ADD)),
        op=Column.BinaryFormula.OP_DIVIDE,
        right=Column(formula=operate_multiple_columns(weights, Column.BinaryFormula.OP_ADD)),
    )


def _total_score_counts(settings: ResolverSettings) -> dict[str, float]:
    """
    Number of scores per vital across the whole query, ignoring any group by. Used as the
    denominator of the opportunity score so each group is weighted by its share of traffic.
    """
    from sentry.snuba.trace_metrics import TraceMetrics

    snuba_params = settings["snuba_params"]

    if snuba_params.organization is None:
        # Dummy response for save query validation
        return {vital: 0 for vital in WEB_VITALS}

    if TOTAL_SCORE_COUNTS_CACHE_KEY in settings["query_result_cache"]:
        response = settings["query_result_cache"][TOTAL_SCORE_COUNTS_CACHE_KEY]
    else:
        response = TraceMetrics.run_table_query(
            params=snuba_params,
            query_string=snuba_params.query_string or "",
            referrer=TOTAL_SCORE_COUNTS_CACHE_KEY,
            selected_columns=[_score_count_column(vital) for vital in WEB_VITALS],
            orderby=None,
            offset=0,
            limit=1,
            sampling_mode=snuba_params.sampling_mode,
            config=TraceMetricsSearchResolverConfig(metric=None, auto_fields=True),
        )
        settings["query_result_cache"][TOTAL_SCORE_COUNTS_CACHE_KEY] = response

    row = response["data"][0] if response["data"] else {}
    return {vital: row.get(_score_count_column(vital)) or 0 for vital in WEB_VITALS}


def _score_deficit(vital: str, settings: ResolverSettings) -> Column.BinaryFormula:
    """``count - sum``, which equals the score points left on the table."""
    return Column.BinaryFormula(
        default_value_double=0.0,
        left=_score_aggregate(Function.FUNCTION_COUNT, vital, settings),
        op=Column.BinaryFormula.OP_SUBTRACT,
        right=_score_aggregate(Function.FUNCTION_SUM, vital, settings),
    )


def opportunity_score(_: ResolvedArguments, settings: ResolverSettings) -> Column.BinaryFormula:
    """
    How much the total score would improve if this group's vitals were perfect. Each vital's
    missing score is divided by that vital's count across the whole query, then the vitals with
    data are combined with their weights rescaled to add up to 1.
    """
    total_counts = _total_score_counts(settings)
    vitals_with_data = [vital for vital in WEB_VITALS if total_counts[vital] > 0]

    if not vitals_with_data:
        # Return any aggregate to satisfy return type. _score_deficit resolves to 0 if there are no rows.
        return _score_deficit(WEB_VITALS[0], settings)

    total_weight = sum(WEB_VITALS_PERFORMANCE_SCORE_WEIGHTS[vital] for vital in vitals_with_data)
    weighted_scores: list[Column] = []
    for vital in vitals_with_data:
        vital_opportunity = _formula_with_default_zero(
            Column(formula=_score_deficit(vital, settings)),
            Column.BinaryFormula.OP_DIVIDE,
            Column(literal=LiteralValue(val_double=total_counts[vital])),
        )
        weight = WEB_VITALS_PERFORMANCE_SCORE_WEIGHTS[vital] / total_weight
        weighted_scores.append(_weighted(vital_opportunity, weight))

    if len(weighted_scores) == 1:
        return weighted_scores[0].formula

    return operate_multiple_columns(weighted_scores, Column.BinaryFormula.OP_ADD)


def _score_metrics(_: ResolvedArguments) -> frozenset[TraceMetric]:
    return frozenset(WEB_VITAL_SCORE_METRICS.values())


TRACE_METRICS_FORMULA_DEFINITIONS: dict[str, FormulaDefinition] = {
    "per_second": TraceMetricFormulaDefinition(
        default_search_type="rate",
        arguments=[
            AttributeArgumentDefinition(
                attribute_types={
                    "string",
                    "number",
                    "integer",
                },
            ),
            ValueArgumentDefinition(argument_types={"string"}, default_arg=""),
            ValueArgumentDefinition(
                argument_types={"string"},
                validator=literal_validator(
                    [
                        "",
                        "counter",
                        "gauge",
                        "distribution",
                    ]
                ),
                default_arg="",
            ),
            ValueArgumentDefinition(argument_types={"string"}, default_arg=""),
        ],
        formula_resolver=per_second,
        is_aggregate=True,
        infer_search_type_from_arguments=False,
        valid_arithmetic=True,
    ),
    "per_minute": TraceMetricFormulaDefinition(
        default_search_type="rate",
        arguments=[
            AttributeArgumentDefinition(
                attribute_types={
                    "string",
                    "number",
                    "integer",
                },
            ),
            ValueArgumentDefinition(argument_types={"string"}, default_arg=""),
            ValueArgumentDefinition(
                argument_types={"string"},
                validator=literal_validator(
                    [
                        "",
                        "counter",
                        "gauge",
                        "distribution",
                    ]
                ),
                default_arg="",
            ),
            ValueArgumentDefinition(argument_types={"string"}, default_arg=""),
        ],
        formula_resolver=per_minute,
        is_aggregate=True,
        infer_search_type_from_arguments=False,
        valid_arithmetic=True,
    ),
}


def if_query_validator(term: str) -> bool:
    if not term.startswith("`") or not term.endswith("`"):
        return False
    return True


def if_combinator(formula: FormulaDefinition) -> FormulaDefinition:
    return ConditionalTraceMetricFormulaDefinition(
        formula_resolver=formula.formula_resolver,
        is_aggregate=formula.is_aggregate,
        default_search_type=formula.default_search_type,
        infer_search_type_from_arguments=formula.infer_search_type_from_arguments,
        internal_type=formula.internal_type,
        extrapolation_mode_override=formula.extrapolation_mode_override,
        processor=formula.processor,
        private=formula.private,
        arguments=[
            ValueArgumentDefinition(argument_types={"query"}, validator=if_query_validator),
            *formula.arguments,
        ],
    )


TRACE_METRICS_FORMULA_COMBINATORS: dict[str, Callable[[FormulaDefinition], FormulaDefinition]] = {
    "if": if_combinator,
}

combinator_formula_definitions: dict[str, FormulaDefinition] = {}
for combinator, apply_combinator in TRACE_METRICS_FORMULA_COMBINATORS.items():
    for formula, definition in TRACE_METRICS_FORMULA_DEFINITIONS.items():
        if definition.is_aggregate:
            combinator_formula_definitions[f"{formula}_{combinator}"] = apply_combinator(definition)

TRACE_METRICS_FORMULA_DEFINITIONS.update(combinator_formula_definitions)


# Special case web vital score formulas, not compatible with combinators.
TRACE_METRICS_FORMULA_DEFINITIONS_WITHOUT_IF: dict[str, FormulaDefinition] = {
    "performance_score": MultiTraceMetricFormulaDefinition(
        default_search_type="percentage",
        infer_search_type_from_arguments=False,
        arguments=[],
        formula_resolver=performance_score,
        trace_metrics_resolver=_score_metrics,
        processor=none_if_zero_processor,
        is_aggregate=True,
        valid_arithmetic=True,
    ),
    "opportunity_score": MultiTraceMetricFormulaDefinition(
        default_search_type="percentage",
        infer_search_type_from_arguments=False,
        arguments=[],
        formula_resolver=opportunity_score,
        trace_metrics_resolver=_score_metrics,
        is_aggregate=True,
        valid_arithmetic=True,
    ),
}

TRACE_METRICS_FORMULA_DEFINITIONS.update(TRACE_METRICS_FORMULA_DEFINITIONS_WITHOUT_IF)
