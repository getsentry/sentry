from sentry_protos.snuba.v1.endpoint_trace_item_table_pb2 import Column
from sentry_protos.snuba.v1.request_common_pb2 import TraceItemType
from sentry_protos.snuba.v1.trace_item_attribute_pb2 import AttributeKey

from sentry.search.eap.uptime_results.attributes import UPTIME_ATTRIBUTE_DEFINITIONS


def get_columns_for_uptime_trace_item_type(
    trace_item_type: TraceItemType.ValueType = TraceItemType.TRACE_ITEM_TYPE_UPTIME_RESULT,
) -> list[Column]:
    if trace_item_type == TraceItemType.TRACE_ITEM_TYPE_UPTIME_RESULT:
        renames = {"status_reason_type": "check_status_reason"}
        return [
            Column(
                label=renames.get(col.internal_name, col.internal_name), key=col.proto_definition
            )
            for col in UPTIME_ATTRIBUTE_DEFINITIONS.values()
        ]
    else:
        return [
            Column(
                label="environment",
                key=AttributeKey(name="environment", type=AttributeKey.Type.TYPE_STRING),
            ),
            Column(
                label="region",
                key=AttributeKey(name="region", type=AttributeKey.Type.TYPE_STRING),
            ),
            Column(
                label="check_status",
                key=AttributeKey(name="check_status", type=AttributeKey.Type.TYPE_STRING),
            ),
            Column(
                label="http_status_code",
                key=AttributeKey(name="http_status_code", type=AttributeKey.Type.TYPE_INT),
            ),
            Column(
                label="incident_status",
                key=AttributeKey(name="incident_status", type=AttributeKey.Type.TYPE_INT),
            ),
            Column(
                label="trace_id",
                key=AttributeKey(name="trace_id", type=AttributeKey.Type.TYPE_STRING),
            ),
            Column(
                label="timestamp",
                key=AttributeKey(
                    name="timestamp",
                    type=AttributeKey.Type.TYPE_DOUBLE,
                ),
            ),
            Column(
                label="uptime_subscription_id",
                key=AttributeKey(name="uptime_subscription_id", type=AttributeKey.Type.TYPE_STRING),
            ),
            Column(
                label="uptime_check_id",
                key=AttributeKey(name="uptime_check_id", type=AttributeKey.Type.TYPE_STRING),
            ),
            Column(
                label="scheduled_check_time",
                key=AttributeKey(name="scheduled_check_time", type=AttributeKey.Type.TYPE_DOUBLE),
            ),
            Column(
                label="duration_ms",
                key=AttributeKey(name="duration_ms", type=AttributeKey.Type.TYPE_INT),
            ),
            Column(
                label="check_status_reason",
                key=AttributeKey(name="check_status_reason", type=AttributeKey.Type.TYPE_STRING),
            ),
        ]
