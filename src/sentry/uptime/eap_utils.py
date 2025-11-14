from typing import int
from sentry_protos.snuba.v1.endpoint_trace_item_table_pb2 import Column
from sentry_protos.snuba.v1.request_common_pb2 import TraceItemType

from sentry.search.eap.uptime_results.attributes import UPTIME_ATTRIBUTE_DEFINITIONS


def get_columns_for_uptime_result() -> list[Column]:
    renames = {"status_reason_type": "check_status_reason"}
    return [
        Column(label=renames.get(col.internal_name, col.internal_name), key=col.proto_definition)
        for col in UPTIME_ATTRIBUTE_DEFINITIONS.values()
    ]


# XXX: Backwards compat for this function
def get_columns_for_uptime_trace_item_type(
    trace_item_type: TraceItemType.ValueType = TraceItemType.TRACE_ITEM_TYPE_UPTIME_RESULT,
) -> list[Column]:
    return get_columns_for_uptime_result()
