"""
Total web vital score formulas for the trace metrics dataset.

Relay emits a ``browser.web_vital.<vital>.score`` distribution for every pageload or interaction
span that scored the vital. Its value is the vital's 0-1 performance score as a ratio. A single
vital's score and count are plain ``avg`` and ``count`` aggregates over that metric, so the only
formulas needed here are the totals, which combine the five score metrics the way the spans
``performance_score(measurements.score.total)`` and ``opportunity_score(measurements.score.total)``
do. They keep the spans argument so the pages table can switch datasets without changing its
fields. Because they read several metrics at once they are ``MultiTraceMetricFormulaDefinition``s.
"""

from sentry_protos.snuba.v1.attribute_conditional_aggregation_pb2 import (
    AttributeConditionalAggregation,
)
from sentry_protos.snuba.v1.endpoint_trace_item_table_pb2 import Column
from sentry_protos.snuba.v1.formula_pb2 import Literal as LiteralValue
from sentry_protos.snuba.v1.trace_item_attribute_pb2 import AttributeKey, Function

from sentry.search.eap.columns import (
    FormulaDefinition,
    MultiTraceMetricFormulaDefinition,
    ResolvedArguments,
    ResolverSettings,
    ValueArgumentDefinition,
)
from sentry.search.eap.spans.utils import operate_multiple_columns
from sentry.search.eap.trace_metrics.config import TraceMetricsSearchResolverConfig
from sentry.search.eap.trace_metrics.types import ANY_UNIT, TraceMetric
from sentry.search.eap.validator import literal_validator
from sentry.search.events.constants import WEB_VITALS_PERFORMANCE_SCORE_WEIGHTS

WEB_VITALS = ["lcp", "fcp", "cls", "ttfb", "inp"]

TOTAL_SCORE_ARGUMENT = "measurements.score.total"

# The unit is left open on purpose: the metric name and type already identify the score, and a
# unit mismatch would silently drop every row.
WEB_VITAL_SCORE_METRICS: dict[str, TraceMetric] = {
    vital: TraceMetric(
        metric_name=f"browser.web_vital.{vital}.score",
        metric_type="distribution",
        metric_unit=ANY_UNIT,
    )
    for vital in WEB_VITALS
}

VALUE_KEY = AttributeKey(name="sentry.value", type=AttributeKey.TYPE_DOUBLE)

TOTAL_SCORE_COUNTS_CACHE_KEY = "trace_metrics_total_score_counts"


def _score_count_column(vital: str) -> str:
    return f"count(value,browser.web_vital.{vital}.score,distribution,{ANY_UNIT})"


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


def _weighted(formula: Column.BinaryFormula, weight: float) -> Column:
    return Column(
        formula=Column.BinaryFormula(
            default_value_double=0.0,
            left=Column(formula=formula),
            op=Column.BinaryFormula.OP_MULTIPLY,
            right=Column(literal=LiteralValue(val_double=weight)),
        )
    )


def none_if_zero_processor(value: float) -> float | None:
    if value == 0:
        return None
    return value


def performance_score(_: ResolvedArguments, settings: ResolverSettings) -> Column.BinaryFormula:
    """
    Weighted average of the per-vital scores, where only vitals with data contribute their weight.
    """
    weighted_scores: list[Column] = []
    weights: list[Column] = []

    for vital in WEB_VITALS:
        weight = WEB_VITALS_PERFORMANCE_SCORE_WEIGHTS[vital]
        vital_score = Column.BinaryFormula(
            default_value_double=0.0,
            left=_score_aggregate(Function.FUNCTION_AVG, vital, settings),
            op=Column.BinaryFormula.OP_MULTIPLY,
            right=Column(literal=LiteralValue(val_double=1.0)),
        )
        weighted_scores.append(_weighted(vital_score, weight))

        # count / count is 1.0 when the vital has data and falls back to 0.0 otherwise
        vital_exists = Column.BinaryFormula(
            default_value_double=0.0,
            left=_score_aggregate(Function.FUNCTION_COUNT, vital, settings),
            op=Column.BinaryFormula.OP_DIVIDE,
            right=_score_aggregate(Function.FUNCTION_COUNT, vital, settings),
        )
        weights.append(_weighted(vital_exists, weight))

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
    # Imported here to avoid a circular import: the dataset module imports the definitions that
    # include these formulas.
    from sentry.snuba.trace_metrics import TraceMetrics

    snuba_params = settings["snuba_params"]

    if snuba_params.organization is None:
        # The function is only being validated (e.g. while saving a dashboard widget), so there
        # is nothing to query.
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


def _missing_score(vital: str, settings: ResolverSettings) -> Column.BinaryFormula:
    """``count - sum`` of the ratios: the score points this group's vital left on the table."""
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
        # The RPC expects an aggregate formula so that group by still applies; without data every
        # vital resolves to 0 anyway.
        return _missing_score("lcp", settings)

    total_weight = sum(WEB_VITALS_PERFORMANCE_SCORE_WEIGHTS[vital] for vital in vitals_with_data)
    weighted_scores: list[Column] = []
    for vital in vitals_with_data:
        vital_opportunity = Column.BinaryFormula(
            default_value_double=0.0,
            left=Column(formula=_missing_score(vital, settings)),
            op=Column.BinaryFormula.OP_DIVIDE,
            right=Column(literal=LiteralValue(val_double=total_counts[vital])),
        )
        weight = WEB_VITALS_PERFORMANCE_SCORE_WEIGHTS[vital] / total_weight
        weighted_scores.append(_weighted(vital_opportunity, weight))

    if len(weighted_scores) == 1:
        return weighted_scores[0].formula

    return operate_multiple_columns(weighted_scores, Column.BinaryFormula.OP_ADD)


def _total_score_argument() -> ValueArgumentDefinition:
    return ValueArgumentDefinition(
        argument_types={"string"},
        validator=literal_validator([TOTAL_SCORE_ARGUMENT]),
    )


def _score_metrics(_: ResolvedArguments) -> frozenset[TraceMetric]:
    return frozenset(WEB_VITAL_SCORE_METRICS.values())


WEB_VITALS_FORMULA_DEFINITIONS: dict[str, FormulaDefinition] = {
    "performance_score": MultiTraceMetricFormulaDefinition(
        default_search_type="percentage",
        infer_search_type_from_arguments=False,
        arguments=[_total_score_argument()],
        formula_resolver=performance_score,
        trace_metrics_resolver=_score_metrics,
        processor=none_if_zero_processor,
        is_aggregate=True,
        valid_arithmetic=True,
    ),
    "opportunity_score": MultiTraceMetricFormulaDefinition(
        default_search_type="percentage",
        infer_search_type_from_arguments=False,
        arguments=[_total_score_argument()],
        formula_resolver=opportunity_score,
        trace_metrics_resolver=_score_metrics,
        is_aggregate=True,
        valid_arithmetic=True,
    ),
}
