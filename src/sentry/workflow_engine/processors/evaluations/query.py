from collections.abc import Mapping, Sequence
from datetime import datetime, timezone
from typing import Any

from google.protobuf.timestamp_pb2 import Timestamp
from sentry_protos.snuba.v1.downsampled_storage_pb2 import DownsampledStorageConfig
from sentry_protos.snuba.v1.endpoint_trace_item_table_pb2 import Column, TraceItemTableRequest
from sentry_protos.snuba.v1.endpoint_trace_items_pb2 import ExportTraceItemsRequest
from sentry_protos.snuba.v1.request_common_pb2 import PageToken, RequestMeta, TraceItemType
from sentry_protos.snuba.v1.trace_item_attribute_pb2 import AttributeKey, AttributeValue, StrArray
from sentry_protos.snuba.v1.trace_item_filter_pb2 import ComparisonFilter, TraceItemFilter

from sentry.search.eap.rpc_utils import (
    and_trace_item_filters,
    anyvalue_to_python,
    create_attribute_value,
    or_trace_item_filters,
)
from sentry.utils import json
from sentry.utils.snuba_rpc import export_logs_rpc, table_rpc

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
    response = table_rpc(
        [
            TraceItemTableRequest(
                meta=meta,
                columns=[item_id_column, timestamp_column],
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
    item_ids = [
        value.val_str
        for column in response.column_values
        if column.attribute_name == "item_id"
        for value in column.results
    ]
    if not item_ids:
        return []

    # The export endpoint returns all stored attributes, but does not support
    # custom ordering. Fetch the selected page in bulk, then restore its order.
    artifacts = export_logs_rpc(
        ExportTraceItemsRequest(
            meta=meta,
            filter=TraceItemFilter(
                comparison_filter=ComparisonFilter(
                    key=item_id_column.key,
                    op=ComparisonFilter.OP_IN,
                    value=AttributeValue(val_str_array=StrArray(values=item_ids)),
                )
            ),
            limit=len(item_ids),
        )
    )
    rows: dict[str, dict[str, Any]] = {}
    for item in artifacts.trace_items:
        row = {name: anyvalue_to_python(value) for name, value in item.attributes.items()}
        for name in JSON_ATTRIBUTES:
            if name in row:
                row[name] = json.loads(row[name])
        row.update(
            item_id=item.item_id.hex(),
            trace_id=item.trace_id,
            timestamp=item.timestamp.ToDatetime(tzinfo=timezone.utc),
            project_id=item.project_id,
        )
        # EAP cannot distinguish absent arrays from stored empty arrays. Concrete
        # workflow artifacts always emit action IDs, including an empty list.
        if "workflow_id" in row:
            row.setdefault("triggered_action_ids", [])
        rows[row["item_id"]] = row
    return [rows[item_id] for item_id in item_ids if item_id in rows]
