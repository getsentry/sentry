from typing import int, cast

from sentry_protos.snuba.v1.endpoint_trace_item_table_pb2 import Column
from sentry_protos.snuba.v1.trace_item_attribute_pb2 import AttributeKey

from sentry.search.eap.columns import ResolvedArguments


def transform_vital_score_to_ratio(args: ResolvedArguments) -> AttributeKey:
    score_attribute = cast(AttributeKey, args[0])
    score_name = score_attribute.name

    ratio_score_name = score_name.replace("score", "score.ratio")
    if ratio_score_name == "score.ratio.total":
        ratio_score_name = "score.total"
    return AttributeKey(name=ratio_score_name, type=AttributeKey.TYPE_DOUBLE)


def operate_multiple_columns(
    columns: list[Column], op: Column.BinaryFormula.Op.ValueType, default_value: float = 0.0
) -> Column.BinaryFormula:
    if len(columns) < 2:
        raise ValueError("No columns to operate")

    def _operate_multiple_columns(idx: int) -> Column.BinaryFormula:
        two_columns_left = idx == len(columns) - 2
        if two_columns_left:
            return Column.BinaryFormula(
                default_value_double=default_value, left=columns[idx], op=op, right=columns[idx + 1]
            )
        return Column.BinaryFormula(
            default_value_double=default_value,
            left=columns[idx],
            op=op,
            right=Column(formula=_operate_multiple_columns(idx + 1)),
        )

    return _operate_multiple_columns(0)


WEB_VITALS_MEASUREMENTS = [
    "measurements.score.total",
    "measurements.score.lcp",
    "measurements.score.fcp",
    "measurements.score.cls",
    "measurements.score.ttfb",
    "measurements.score.inp",
]
