from collections.abc import Mapping, Sequence
from datetime import datetime, timezone
from typing import Any

from google.protobuf.timestamp_pb2 import Timestamp
from sentry_protos.snuba.v1.downsampled_storage_pb2 import DownsampledStorageConfig
from sentry_protos.snuba.v1.endpoint_trace_item_table_pb2 import Column, TraceItemTableRequest
from sentry_protos.snuba.v1.request_common_pb2 import PageToken, RequestMeta, TraceItemType
from sentry_protos.snuba.v1.trace_item_attribute_pb2 import AttributeKey
from sentry_protos.snuba.v1.trace_item_filter_pb2 import ComparisonFilter, TraceItemFilter

from sentry.search.eap.rpc_utils import (
    and_trace_item_filters,
    anyvalue_to_python,
    create_attribute_value,
    or_trace_item_filters,
)
from sentry.utils import json
from sentry.utils.snuba_rpc import table_rpc

# Only these attributes are supported as API filters.
EVALUATION_FILTER_TYPES: dict[str, AttributeKey.Type.ValueType] = {
    "detector_id": AttributeKey.TYPE_INT,
    "workflow_id": AttributeKey.TYPE_INT,
    "group_id": AttributeKey.TYPE_INT,
    "event_id": AttributeKey.TYPE_STRING,
    "project_id": AttributeKey.TYPE_INT,
    "detector_type": AttributeKey.TYPE_STRING,
    "outcome": AttributeKey.TYPE_STRING,
    "error": AttributeKey.TYPE_STRING,
    "evaluation_type": AttributeKey.TYPE_STRING,
    "evaluation_phase": AttributeKey.TYPE_STRING,
}
JSON_ATTRIBUTES = frozenset({"trigger_evaluation", "filter_evaluations", "delayed"})
_EVALUATION_ATTRIBUTE_TYPES: dict[str, AttributeKey.Type.ValueType] = {
    **EVALUATION_FILTER_TYPES,
    "trace_id": AttributeKey.TYPE_STRING,
    "triggered": AttributeKey.TYPE_BOOLEAN,
    "group_key": AttributeKey.TYPE_STRING,
    "priority": AttributeKey.TYPE_INT,
    "trigger_evaluation": AttributeKey.TYPE_STRING,
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
}


def build_evaluation_filter(filters: Mapping[str, Sequence[Any]]) -> TraceItemFilter | None:
    """AND between fields, OR between repeated values."""
    conditions: list[TraceItemFilter | None] = []
    for name, values in filters.items():
        attr_type = EVALUATION_FILTER_TYPES[name]
        key = AttributeKey(
            name="sentry.project_id" if name == "project_id" else name, type=attr_type
        )
        conditions.append(
            or_trace_item_filters(
                *[
                    TraceItemFilter(
                        comparison_filter=ComparisonFilter(
                            key=key,
                            op=ComparisonFilter.OP_EQUALS,
                            value=create_attribute_value(attr_type, value),
                        )
                    )
                    for value in values
                ]
            )
        )
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
    meta = RequestMeta(
        organization_id=organization_id,
        project_ids=project_ids,
        trace_item_type=TraceItemType.TRACE_ITEM_TYPE_WORKFLOW_ENGINE_EVALUATION,
        start_timestamp=start_timestamp,
        end_timestamp=end_timestamp,
        referrer="api.workflow-engine.evaluation-artifacts",
        downsampled_storage_config=DownsampledStorageConfig(
            mode=DownsampledStorageConfig.MODE_HIGHEST_ACCURACY
        ),
    )
    item_id_column = Column(
        label="item_id", key=AttributeKey(name="sentry.item_id", type=AttributeKey.TYPE_STRING)
    )
    timestamp_column = Column(
        label="timestamp", key=AttributeKey(name="sentry.timestamp", type=AttributeKey.TYPE_DOUBLE)
    )
    columns = [
        item_id_column,
        timestamp_column,
        *[
            Column(
                label=name,
                key=AttributeKey(
                    name=f"sentry.{name}" if name in {"project_id", "trace_id"} else name,
                    type=attr_type,
                ),
            )
            for name, attr_type in _EVALUATION_ATTRIBUTE_TYPES.items()
        ],
        # Known activity types are names; unknown types retain their integer IDs.
        Column(
            label="activity_type_string",
            key=AttributeKey(name="activity_type", type=AttributeKey.TYPE_STRING),
        ),
        Column(
            label="activity_type_int",
            key=AttributeKey(name="activity_type", type=AttributeKey.TYPE_INT),
        ),
    ]
    response = table_rpc(
        [
            TraceItemTableRequest(
                meta=meta,
                columns=columns,
                filter=filters,
                order_by=[
                    TraceItemTableRequest.OrderBy(column=column, descending=True)
                    for column in (timestamp_column, item_id_column)
                ],
                page_token=PageToken(offset=offset),
                limit=limit,
            )
        ]
    )[0]
    if not response.column_values:
        return []

    rows: list[dict[str, Any]] = [{} for _ in response.column_values[0].results]
    for column in response.column_values:
        name = column.attribute_name
        if name in {"activity_type_string", "activity_type_int"}:
            name = "activity_type"
        for row, value in zip(rows, column.results, strict=True):
            if value.is_null:
                continue
            converted = anyvalue_to_python(value)
            if name in JSON_ATTRIBUTES:
                converted = json.loads(converted)
            elif name == "timestamp":
                converted = datetime.fromtimestamp(converted, tz=timezone.utc)
            row[name] = converted

    for row in rows:
        # EAP cannot distinguish absent arrays from stored empty arrays. Concrete
        # workflow artifacts always emit action IDs, including an empty list.
        if "workflow_id" in row:
            row.setdefault("triggered_action_ids", [])
    return rows
