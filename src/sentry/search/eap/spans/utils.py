from typing import cast

from sentry_protos.snuba.v1.trace_item_attribute_pb2 import AttributeKey

from sentry.search.eap.columns import ResolvedArguments


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
