from sentry_protos.snuba.v1.trace_item_attribute_pb2 import Function

from sentry.search.eap import constants
from sentry.search.eap.aggregate_utils import count_processor
from sentry.search.eap.columns import AggregateDefinition, AttributeArgumentDefinition

COUNT_UNIQUE_ATTRIBUTE_TYPES = frozenset(
    {
        "string",
        "duration",
        "number",
        "integer",
        "percentage",
        "currency",
        *constants.SIZE_TYPE,
        *constants.DURATION_TYPE,
    }
)


def count_unique_aggregate_definition(
    *,
    default_arg: str | None = None,
) -> AggregateDefinition:
    """Shared count_unique aggregate for EAP datasets (spans, occurrences, ourlogs)."""
    return AggregateDefinition(
        internal_function=Function.FUNCTION_UNIQ,
        default_search_type="integer",
        infer_search_type_from_arguments=False,
        processor=count_processor,
        arguments=[
            AttributeArgumentDefinition(
                attribute_types=set(COUNT_UNIQUE_ATTRIBUTE_TYPES),
                default_arg=default_arg,
            )
        ],
    )
