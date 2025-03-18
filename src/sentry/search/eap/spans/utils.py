from typing import Literal, cast

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


WEB_VITALS_MEASUREMENTS = [
    "measurements.score.total",
    "measurements.score.lcp",
    "measurements.score.fcp",
    "measurements.score.cls",
    "measurements.score.ttfb",
    "measurements.score.inp",
]
