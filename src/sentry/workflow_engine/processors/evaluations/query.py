from collections.abc import Mapping, Sequence
from datetime import datetime, timezone
from typing import Any

from google.protobuf.timestamp_pb2 import Timestamp
from sentry_protos.snuba.v1.downsampled_storage_pb2 import DownsampledStorageConfig
from sentry_protos.snuba.v1.endpoint_trace_item_table_pb2 import Column, TraceItemTableRequest
from sentry_protos.snuba.v1.request_common_pb2 import PageToken, RequestMeta, TraceItemType
from sentry_protos.snuba.v1.trace_item_attribute_pb2 import AttributeKey, AttributeValue, IntArray
from sentry_protos.snuba.v1.trace_item_filter_pb2 import ComparisonFilter, TraceItemFilter

from sentry.search.eap.rpc_utils import (
    and_trace_item_filters,
    anyvalue_to_python,
    create_attribute_value,
    or_trace_item_filters,
)
from sentry.utils import json
from sentry.utils.snuba_rpc import table_rpc

# These names and types match the attributes emitted by evaluations/eap.py.
EVALUATION_ATTRIBUTE_TYPES: dict[str, AttributeKey.Type.ValueType] = {
    "project_id": AttributeKey.TYPE_INT,
    "item_id": AttributeKey.TYPE_STRING,
    "trace_id": AttributeKey.TYPE_STRING,
    "evaluation_type": AttributeKey.TYPE_STRING,
    "evaluation_phase": AttributeKey.TYPE_STRING,
    "outcome": AttributeKey.TYPE_STRING,
    "error": AttributeKey.TYPE_STRING,
    "detector_id": AttributeKey.TYPE_INT,
    "detector_type": AttributeKey.TYPE_STRING,
    "event_id": AttributeKey.TYPE_STRING,
    "triggered": AttributeKey.TYPE_BOOLEAN,
    "group_key": AttributeKey.TYPE_STRING,
    "priority": AttributeKey.TYPE_INT,
    "trigger_evaluation": AttributeKey.TYPE_STRING,
    "workflow_id": AttributeKey.TYPE_INT,
    "group_id": AttributeKey.TYPE_INT,
    "filter_evaluations": AttributeKey.TYPE_STRING,
    "triggered_action_ids": AttributeKey.TYPE_ARRAY_INT,
    "delayed": AttributeKey.TYPE_STRING,
    "event_kind": AttributeKey.TYPE_STRING,
    "issue_status": AttributeKey.TYPE_INT,
    "issue_substatus": AttributeKey.TYPE_INT,
    "issue_priority": AttributeKey.TYPE_INT,
    "environment_id": AttributeKey.TYPE_INT,
    "is_resolved": AttributeKey.TYPE_BOOLEAN,
    "is_new": AttributeKey.TYPE_BOOLEAN,
    "is_regression": AttributeKey.TYPE_BOOLEAN,
    "is_new_group_environment": AttributeKey.TYPE_BOOLEAN,
    "has_escalated": AttributeKey.TYPE_BOOLEAN,
    "activity_type": AttributeKey.TYPE_STRING,
}
JSON_ATTRIBUTES = frozenset({"trigger_evaluation", "filter_evaluations", "delayed"})
METADATA_COLUMNS = {
    "item_id": AttributeKey(name="sentry.item_id", type=AttributeKey.TYPE_STRING),
    "trace_id": AttributeKey(name="sentry.trace_id", type=AttributeKey.TYPE_STRING),
    "timestamp": AttributeKey(name="sentry.timestamp", type=AttributeKey.TYPE_DOUBLE),
    "project_id": AttributeKey(name="sentry.project_id", type=AttributeKey.TYPE_INT),
}


def build_evaluation_filter(filters: Mapping[str, Sequence[Any]]) -> TraceItemFilter | None:
    """AND between fields, OR between repeated values; action IDs use array membership."""
    conditions: list[TraceItemFilter | None] = []
    for name, values in filters.items():
        if name == "triggered_action_ids":
            conditions.append(
                TraceItemFilter(
                    comparison_filter=ComparisonFilter(
                        key=AttributeKey(name=name, type=AttributeKey.TYPE_ARRAY_INT),
                        op=ComparisonFilter.OP_HAS_ANY,
                        value=AttributeValue(val_int_array=IntArray(values=values)),
                    )
                )
            )
            continue
        comparisons = []
        for value in values:
            attr_type = EVALUATION_ATTRIBUTE_TYPES[name]
            if name == "activity_type" and isinstance(value, int):
                attr_type = AttributeKey.TYPE_INT
            comparisons.append(
                TraceItemFilter(
                    comparison_filter=ComparisonFilter(
                        key=METADATA_COLUMNS.get(name) or AttributeKey(name=name, type=attr_type),
                        op=ComparisonFilter.OP_EQUALS,
                        value=create_attribute_value(attr_type, value),
                    )
                )
            )
        conditions.append(or_trace_item_filters(*comparisons))
    return and_trace_item_filters(*conditions)


def query_evaluation_artifacts(
    *,
    organization_id: int,
    project_ids: Sequence[int],
    start: datetime,
    end: datetime,
    filters: TraceItemFilter | None,
    offset: int,
    limit: int,
) -> list[dict[str, Any]]:
    start_timestamp, end_timestamp = Timestamp(), Timestamp()
    start_timestamp.FromDatetime(start)
    end_timestamp.FromDatetime(end)
    columns = {name: Column(label=name, key=key) for name, key in METADATA_COLUMNS.items()}
    columns.update(
        {
            name: Column(label=name, key=AttributeKey(name=name, type=attr_type))
            for name, attr_type in EVALUATION_ATTRIBUTE_TYPES.items()
            if name not in METADATA_COLUMNS
        }
    )
    # ActivityType names are strings; unknown activity types are emitted as integers.
    columns["activity_type_numeric"] = Column(
        label="activity_type_numeric",
        key=AttributeKey(name="activity_type", type=AttributeKey.TYPE_INT),
    )
    rpc_request = TraceItemTableRequest(
        meta=RequestMeta(
            organization_id=organization_id,
            project_ids=project_ids,
            trace_item_type=TraceItemType.TRACE_ITEM_TYPE_WORKFLOW_ENGINE_EVALUATION,
            start_timestamp=start_timestamp,
            end_timestamp=end_timestamp,
            referrer="api.workflow-engine.evaluation-artifacts",
            downsampled_storage_config=DownsampledStorageConfig(
                mode=DownsampledStorageConfig.MODE_HIGHEST_ACCURACY
            ),
        ),
        columns=columns.values(),
        filter=filters,
        order_by=[
            TraceItemTableRequest.OrderBy(column=columns[name], descending=True)
            for name in ("timestamp", "item_id")
        ],
        page_token=PageToken(offset=offset),
        limit=limit,
    )
    response = table_rpc([rpc_request])[0]
    row_count = len(response.column_values[0].results) if response.column_values else 0
    rows: list[dict[str, Any]] = [{} for _ in range(row_count)]
    for column in response.column_values:
        for index, value in enumerate(column.results):
            which = value.WhichOneof("value")
            if value.is_null or which in (None, "val_null"):
                continue
            name = column.attribute_name
            decoded = anyvalue_to_python(value)
            if name in JSON_ATTRIBUTES:
                decoded = json.loads(decoded)
            elif name == "timestamp":
                decoded = datetime.fromtimestamp(decoded, tz=timezone.utc)
            elif name == "activity_type_numeric":
                name = "activity_type"
            rows[index][name] = decoded
    for row in rows:
        # EAP cannot distinguish absent arrays from stored empty arrays. Concrete
        # workflow artifacts always emit action IDs, including an empty list.
        if "workflow_id" in row:
            row.setdefault("triggered_action_ids", [])
    return rows
