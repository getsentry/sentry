from sentry_protos.snuba.v1.trace_item_attribute_pb2 import ExtrapolationMode

from sentry.search.eap.types import SearchResolverConfig


def resolve_extrapolation_mode(
    search_config: SearchResolverConfig,
    argument_override: ExtrapolationMode.ValueType | None = None,
) -> ExtrapolationMode.ValueType:
    if search_config.disable_aggregate_extrapolation:
        return ExtrapolationMode.EXTRAPOLATION_MODE_NONE

    if argument_override is not None:
        return argument_override

    if search_config.extrapolation_mode is not None:
        return search_config.extrapolation_mode

    return ExtrapolationMode.EXTRAPOLATION_MODE_SAMPLE_WEIGHTED
