from typing import Literal, cast

from sentry_protos.snuba.v1.endpoint_trace_item_table_pb2 import Column
from sentry_protos.snuba.v1.trace_item_attribute_pb2 import AttributeKey

from sentry.search.eap.columns import ResolvedArguments
from sentry.search.eap.spans.attributes import SPAN_ATTRIBUTE_DEFINITIONS

INTERNAL_TO_PUBLIC_ALIAS_MAPPINGS: dict[Literal["string", "number"], dict[str, str]] = {
    "string": {
        definition.internal_name: definition.public_alias
        for definition in SPAN_ATTRIBUTE_DEFINITIONS.values()
        if not definition.secondary_alias and definition.search_type == "string"
    }
    | {
        # sentry.service is the project id as a string, but map to project for convenience
        "sentry.service": "project",
    },
    "number": {
        definition.internal_name: definition.public_alias
        for definition in SPAN_ATTRIBUTE_DEFINITIONS.values()
        if not definition.secondary_alias and definition.search_type != "string"
    },
}


def translate_internal_to_public_alias(
    internal_alias: str,
    type: Literal["string", "number"],
) -> str | None:
    mappings = INTERNAL_TO_PUBLIC_ALIAS_MAPPINGS.get(type, {})
    return mappings.get(internal_alias)


def transform_vital_score_to_ratio(args: ResolvedArguments) -> AttributeKey:
    score_attribute = cast(AttributeKey, args[0])
    score_name = score_attribute.name

    ratio_score_name = score_name.replace("score", "score.ratio")
    if ratio_score_name == "score.ratio.total":
        ratio_score_name = "score.total"
    return AttributeKey(name=ratio_score_name, type=AttributeKey.TYPE_DOUBLE)


def operate_multiple_columns(
    columns: list[Column], op: Column.BinaryFormula.Op.ValueType
) -> Column.BinaryFormula:
    def _operate_multiple_columns(idx: int):
        two_columns_left = idx == len(columns) - 2
        if two_columns_left:
            return Column.BinaryFormula(left=columns[idx], op=op, right=columns[idx + 1])
        return Column.BinaryFormula(
            left=columns[idx], op=op, right=Column(formula=_operate_multiple_columns(idx + 1))
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
