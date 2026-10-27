"""
Web vital score formulas for the trace metrics dataset.

Relay emits one distribution metric per web vital (``browser.web_vital.lcp`` and so on) for every
pageload or interaction span that carries that vital, and copies the vital's ``score.<vital>``,
``score.ratio.<vital>`` and ``score.weight.<vital>`` attributes onto the metric.

These formulas mirror ``performance_score``, ``opportunity_score`` and ``count_scores`` from the
spans dataset, and accept the same ``measurements.score.<vital>`` arguments, so a dashboard widget
can switch datasets without changing its fields. Because each vital lives on its own metric the
formulas read from several metrics at once, which is why they are ``MultiTraceMetricFormulaDefinition``s.
"""

from typing import cast

from sentry_protos.snuba.v1.attribute_conditional_aggregation_pb2 import (
    AttributeConditionalAggregation,
)
from sentry_protos.snuba.v1.endpoint_trace_item_table_pb2 import Column
from sentry_protos.snuba.v1.formula_pb2 import Literal as LiteralValue
from sentry_protos.snuba.v1.trace_item_attribute_pb2 import AttributeKey, Function
from sentry_protos.snuba.v1.trace_item_filter_pb2 import (
    AndFilter,
    ExistsFilter,
    OrFilter,
    TraceItemFilter,
)

from sentry.search.eap.columns import (
    FormulaDefinition,
    MultiTraceMetricFormulaDefinition,
    ResolvedArguments,
    ResolverSettings,
    ValueArgumentDefinition,
)
from sentry.search.eap.spans.utils import WEB_VITALS_MEASUREMENTS, operate_multiple_columns
from sentry.search.eap.trace_metrics.config import TraceMetricsSearchResolverConfig
from sentry.search.eap.trace_metrics.types import ANY_UNIT, TraceMetric
from sentry.search.eap.validator import literal_validator
from sentry.search.events.constants import WEB_VITALS_PERFORMANCE_SCORE_WEIGHTS

WEB_VITALS = ["lcp", "fcp", "cls", "ttfb", "inp"]

# The unit is left open on purpose: the metric name and type already identify the vital, and a
# unit mismatch would silently drop every row.
WEB_VITAL_TRACE_METRICS: dict[str, TraceMetric] = {
    vital: TraceMetric(
        metric_name=f"browser.web_vital.{vital}",
        metric_type="distribution",
        metric_unit=ANY_UNIT,
    )
    for vital in WEB_VITALS
}

# Set by the SDK on every web vital span and copied onto the metric by Relay.
PAGELOAD_SPAN_ID_KEY = AttributeKey(name="sentry.pageload.span_id", type=AttributeKey.TYPE_STRING)

TOTAL_VITAL_COUNTS_CACHE_KEY = "trace_metrics_total_vital_counts"


def _vital_from_arguments(args: ResolvedArguments) -> str:
    # e.g. "measurements.score.lcp" -> "lcp"
    return cast(str, args[0]).rsplit(".", 1)[-1]


def _trace_metrics_for_arguments(args: ResolvedArguments) -> frozenset[TraceMetric]:
    vital = _vital_from_arguments(args)
    if vital == "total":
        return frozenset(WEB_VITAL_TRACE_METRICS.values())
    return frozenset([WEB_VITAL_TRACE_METRICS[vital]])


def _score_ratio_key(vital: str) -> AttributeKey:
    return AttributeKey(name=f"score.ratio.{vital}", type=AttributeKey.TYPE_DOUBLE)


def _vital_filter(vital: str) -> TraceItemFilter:
    """Rows of this vital's metric that carry a score ratio."""
    return TraceItemFilter(
        and_filter=AndFilter(
            filters=[
                WEB_VITAL_TRACE_METRICS[vital].get_filter(),
                TraceItemFilter(exists_filter=ExistsFilter(key=_score_ratio_key(vital))),
            ]
        )
    )


def _score_ratio_aggregate(
    aggregate: Function.ValueType, vital: str, settings: ResolverSettings
) -> Column:
    return Column(
        conditional_aggregation=AttributeConditionalAggregation(
            aggregate=aggregate,
            key=_score_ratio_key(vital),
            filter=_vital_filter(vital),
            extrapolation_mode=settings["extrapolation_mode"],
        )
    )


def none_if_zero_processor(value: float) -> float | None:
    if value == 0:
        return None
    return value


def int_processor(value: float | None) -> int | None:
    if value is None:
        return None
    return int(value)


def performance_score(args: ResolvedArguments, settings: ResolverSettings) -> Column.BinaryFormula:
    vital = _vital_from_arguments(args)
    if vital == "total":
        return total_performance_score(args, settings)

    return Column.BinaryFormula(
        default_value_double=0.0,
        left=_score_ratio_aggregate(Function.FUNCTION_AVG, vital, settings),
        op=Column.BinaryFormula.OP_MULTIPLY,
        right=Column(literal=LiteralValue(val_double=1.0)),
    )


def total_performance_score(
    _: ResolvedArguments, settings: ResolverSettings
) -> Column.BinaryFormula:
    """
    Weighted average of the per-vital scores, where only vitals with data contribute their weight.
    """
    weighted_scores: list[Column] = []
    weights: list[Column] = []

    for vital in WEB_VITALS:
        weight = WEB_VITALS_PERFORMANCE_SCORE_WEIGHTS[vital]
        weighted_scores.append(
            Column(
                formula=Column.BinaryFormula(
                    default_value_double=0.0,
                    left=Column(
                        formula=performance_score([f"measurements.score.{vital}"], settings)
                    ),
                    op=Column.BinaryFormula.OP_MULTIPLY,
                    right=Column(literal=LiteralValue(val_double=weight)),
                )
            )
        )
        # count / count is 1.0 when the vital has data and falls back to 0.0 otherwise
        vital_exists = Column.BinaryFormula(
            default_value_double=0.0,
            left=_score_ratio_aggregate(Function.FUNCTION_COUNT, vital, settings),
            op=Column.BinaryFormula.OP_DIVIDE,
            right=_score_ratio_aggregate(Function.FUNCTION_COUNT, vital, settings),
        )
        weights.append(
            Column(
                formula=Column.BinaryFormula(
                    default_value_double=0.0,
                    left=Column(literal=LiteralValue(val_double=weight)),
                    op=Column.BinaryFormula.OP_MULTIPLY,
                    right=Column(formula=vital_exists),
                )
            )
        )

    return Column.BinaryFormula(
        default_value_double=0.0,
        left=Column(formula=operate_multiple_columns(weighted_scores, Column.BinaryFormula.OP_ADD)),
        op=Column.BinaryFormula.OP_DIVIDE,
        right=Column(formula=operate_multiple_columns(weights, Column.BinaryFormula.OP_ADD)),
    )


def count_scores(args: ResolvedArguments, settings: ResolverSettings) -> Column.BinaryFormula:
    """
    Number of rows that carry a score for the vital.

    For ``total`` this is the number of distinct pageloads that produced any web vital, which is
    the closest equivalent of the spans dataset counting pageload spans with a total score.
    """
    vital = _vital_from_arguments(args)
    if vital == "total":
        count = Column(
            conditional_aggregation=AttributeConditionalAggregation(
                aggregate=Function.FUNCTION_UNIQ,
                key=PAGELOAD_SPAN_ID_KEY,
                filter=TraceItemFilter(
                    or_filter=OrFilter(filters=[_vital_filter(vital) for vital in WEB_VITALS])
                ),
                extrapolation_mode=settings["extrapolation_mode"],
            )
        )
    else:
        count = _score_ratio_aggregate(Function.FUNCTION_COUNT, vital, settings)

    return Column.BinaryFormula(
        default_value_double=0.0,
        left=count,
        op=Column.BinaryFormula.OP_MULTIPLY,
        right=Column(literal=LiteralValue(val_double=1.0)),
    )


def get_count_of_vital(vital: str, settings: ResolverSettings) -> float:
    """
    Total number of scores for the vital across the whole query, ignoring any group by. Used as
    the denominator of the opportunity score so each group is weighted by its share of traffic.
    """
    # Imported here to avoid a circular import: the dataset module imports the definitions that
    # include these formulas.
    from sentry.snuba.trace_metrics import TraceMetrics

    vital_column = f"count_scores(measurements.score.{vital})"
    snuba_params = settings["snuba_params"]

    if snuba_params.organization is None:
        # The function is only being validated (e.g. while saving a dashboard widget), so there
        # is nothing to query.
        return 0

    if TOTAL_VITAL_COUNTS_CACHE_KEY in settings["query_result_cache"]:
        response = settings["query_result_cache"][TOTAL_VITAL_COUNTS_CACHE_KEY]
    else:
        response = TraceMetrics.run_table_query(
            params=snuba_params,
            query_string=snuba_params.query_string or "",
            referrer=TOTAL_VITAL_COUNTS_CACHE_KEY,
            selected_columns=[
                f"count_scores({measurement})" for measurement in WEB_VITALS_MEASUREMENTS
            ],
            orderby=None,
            offset=0,
            limit=1,
            sampling_mode=snuba_params.sampling_mode,
            config=TraceMetricsSearchResolverConfig(metric=None, auto_fields=True),
        )
        settings["query_result_cache"][TOTAL_VITAL_COUNTS_CACHE_KEY] = response

    if len(response["data"]) > 0 and response["data"][0][vital_column] is not None:
        return response["data"][0][vital_column]

    return 0


def opportunity_score(args: ResolvedArguments, settings: ResolverSettings) -> Column.BinaryFormula:
    """
    How much the total score would improve if this group's vital were perfect:
    ``(count - sum(score.ratio)) / total count of the vital``.
    """
    vital = _vital_from_arguments(args)
    if vital == "total":
        return total_opportunity_score(args, settings)

    missing_score = Column.BinaryFormula(
        default_value_double=0.0,
        left=_score_ratio_aggregate(Function.FUNCTION_COUNT, vital, settings),
        op=Column.BinaryFormula.OP_SUBTRACT,
        right=_score_ratio_aggregate(Function.FUNCTION_SUM, vital, settings),
    )

    return Column.BinaryFormula(
        default_value_double=0.0,
        left=Column(formula=missing_score),
        op=Column.BinaryFormula.OP_DIVIDE,
        right=Column(literal=LiteralValue(val_double=get_count_of_vital(vital, settings))),
    )


def total_opportunity_score(
    _: ResolvedArguments, settings: ResolverSettings
) -> Column.BinaryFormula:
    weighted_scores: list[Column] = []
    vitals_with_data: list[tuple[Column.BinaryFormula, str]] = []
    total_weight = 0.0

    for vital in WEB_VITALS:
        formula = opportunity_score([f"measurements.score.{vital}"], settings)
        if formula.right.literal.val_double > 0:
            vitals_with_data.append((formula, vital))
            total_weight += WEB_VITALS_PERFORMANCE_SCORE_WEIGHTS[vital]

    for formula, vital in vitals_with_data:
        weighted_scores.append(
            Column(
                formula=Column.BinaryFormula(
                    default_value_double=0.0,
                    left=Column(formula=formula),
                    op=Column.BinaryFormula.OP_MULTIPLY,
                    right=Column(
                        literal=LiteralValue(
                            val_double=WEB_VITALS_PERFORMANCE_SCORE_WEIGHTS[vital] / total_weight
                        )
                    ),
                )
            )
        )

    if len(weighted_scores) == 0:
        # The RPC expects an aggregate formula so that group by still applies; without data every
        # vital resolves to 0 anyway.
        return opportunity_score(["measurements.score.lcp"], settings)

    if len(weighted_scores) == 1:
        return weighted_scores[0].formula

    return operate_multiple_columns(weighted_scores, Column.BinaryFormula.OP_ADD)


def _vital_argument() -> ValueArgumentDefinition:
    return ValueArgumentDefinition(
        argument_types={"string"},
        validator=literal_validator(WEB_VITALS_MEASUREMENTS),
    )


WEB_VITALS_FORMULA_DEFINITIONS: dict[str, FormulaDefinition] = {
    "performance_score": MultiTraceMetricFormulaDefinition(
        default_search_type="percentage",
        infer_search_type_from_arguments=False,
        arguments=[_vital_argument()],
        formula_resolver=performance_score,
        trace_metrics_resolver=_trace_metrics_for_arguments,
        processor=none_if_zero_processor,
        is_aggregate=True,
        valid_arithmetic=True,
    ),
    "opportunity_score": MultiTraceMetricFormulaDefinition(
        default_search_type="percentage",
        infer_search_type_from_arguments=False,
        arguments=[_vital_argument()],
        formula_resolver=opportunity_score,
        trace_metrics_resolver=_trace_metrics_for_arguments,
        is_aggregate=True,
        valid_arithmetic=True,
    ),
    "count_scores": MultiTraceMetricFormulaDefinition(
        default_search_type="integer",
        infer_search_type_from_arguments=False,
        arguments=[_vital_argument()],
        formula_resolver=count_scores,
        trace_metrics_resolver=_trace_metrics_for_arguments,
        processor=int_processor,
        is_aggregate=True,
        valid_arithmetic=True,
    ),
}
