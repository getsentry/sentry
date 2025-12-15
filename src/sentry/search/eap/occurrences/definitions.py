from sentry_protos.snuba.v1.request_common_pb2 import TraceItemType
from sentry_protos.snuba.v1.trace_item_attribute_pb2 import AttributeKey, Function

from sentry.search.eap import constants
from sentry.search.eap.columns import (
    AggregateDefinition,
    AttributeArgumentDefinition,
    ColumnDefinitions,
    ResolvedAttribute,
)
from sentry.search.eap.common_columns import COMMON_COLUMNS

OCCURRENCES_ALWAYS_PRESENT_ATTRIBUTES = [
    AttributeKey(name="group_id", type=AttributeKey.Type.TYPE_INT),
]


OCCURRENCE_COLUMNS = {
    column.public_alias: column
    for column in (
        COMMON_COLUMNS
        + [
            ResolvedAttribute(
                public_alias="id",
                internal_name="sentry.item_id",
                search_type="string",
            ),
            ResolvedAttribute(
                public_alias="group_id",
                internal_name="group_id",
                search_type="integer",
            ),
        ]
    )
}

OCCURRENCE_DEFINITIONS = ColumnDefinitions(
    aggregates={
        "avg": AggregateDefinition(
            internal_function=Function.FUNCTION_AVG,
            default_search_type="duration",
            arguments=[
                AttributeArgumentDefinition(
                    attribute_types={
                        "duration",
                        "number",
                        "percentage",
                        "integer",
                        "currency",
                        *constants.SIZE_TYPE,
                        *constants.DURATION_TYPE,
                    },
                )
            ],
        ),
    },  # c.f. SPAN_AGGREGATE_DEFINITIONS when we're ready.
    formulas={},
    columns=OCCURRENCE_COLUMNS,
    contexts={},
    trace_item_type=TraceItemType.TRACE_ITEM_TYPE_OCCURRENCE,
    filter_aliases={},
    alias_to_column=None,
    column_to_alias=None,
)
