from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

from google.protobuf.timestamp_pb2 import Timestamp
from sentry_protos.snuba.v1.downsampled_storage_pb2 import DownsampledStorageConfig
from sentry_protos.snuba.v1.endpoint_trace_item_table_pb2 import (
    Column,
    TraceItemTableRequest,
    TraceItemTableResponse,
)
from sentry_protos.snuba.v1.request_common_pb2 import (
    PageToken,
    RequestMeta,
    TraceItemType,
)
from sentry_protos.snuba.v1.trace_item_attribute_pb2 import AttributeKey, AttributeValue
from sentry_protos.snuba.v1.trace_item_filter_pb2 import (
    AndFilter,
    ComparisonFilter,
    TraceItemFilter,
)

from sentry.utils import snuba_rpc


@dataclass
class PreprodSizeFilters:
    # IDs
    artifact_id: int | None = None

    # App/Artifact attributes
    app_id: str | None = None
    artifact_type: int | None = None

    # Build configuration
    build_configuration_name: str | None = None

    # Git attributes
    git_head_ref: str | None = None
    git_head_sha: str | None = None
    git_base_ref: str | None = None
    git_base_sha: str | None = None
    git_provider: str | None = None
    git_head_repo_name: str | None = None
    git_base_repo_name: str | None = None
    git_pr_number: int | None = None


_FIELD_TYPES: dict[str, AttributeKey.Type.ValueType] = {
    "app_id": AttributeKey.Type.TYPE_STRING,
    "artifact_type": AttributeKey.Type.TYPE_INT,
    "build_configuration_name": AttributeKey.Type.TYPE_STRING,
    "git_head_ref": AttributeKey.Type.TYPE_STRING,
    "git_head_sha": AttributeKey.Type.TYPE_STRING,
    "git_base_ref": AttributeKey.Type.TYPE_STRING,
    "git_base_sha": AttributeKey.Type.TYPE_STRING,
    "git_provider": AttributeKey.Type.TYPE_STRING,
    "git_head_repo_name": AttributeKey.Type.TYPE_STRING,
    "git_base_repo_name": AttributeKey.Type.TYPE_STRING,
    "git_pr_number": AttributeKey.Type.TYPE_INT,
    # Note: artifact_id is handled specially (converted to trace_id)
}


def query_preprod_size_metrics(
    organization_id: int,
    project_ids: list[int],
    start: datetime,
    end: datetime,
    filters: PreprodSizeFilters | None = None,
    limit: int = 100,
    offset: int = 0,
) -> TraceItemTableResponse:
    """
    Query preprod size metrics from EAP.

    Example:
        # Query all iOS Release builds on main branch for a specific app
        query_preprod_size_metrics(
            organization_id=1,
            project_ids=[1, 2],
            start=datetime.now() - timedelta(days=30),
            end=datetime.now(),
            filters=PreprodSizeFilters(
                app_id="com.example.app",
                artifact_type=0,  # iOS
                build_configuration_name="Release",
                git_head_ref="main",
            ),
        )
    """
    start_timestamp = Timestamp()
    start_timestamp.FromDatetime(start)

    end_timestamp = Timestamp()
    end_timestamp.FromDatetime(end)

    columns = [
        # IDs
        Column(
            key=AttributeKey(name="preprod_artifact_id", type=AttributeKey.Type.TYPE_INT),
            label="preprod_artifact_id",
        ),
        Column(
            key=AttributeKey(name="size_metric_id", type=AttributeKey.Type.TYPE_INT),
            label="size_metric_id",
        ),
        # Size metrics
        Column(
            key=AttributeKey(name="metrics_artifact_type", type=AttributeKey.Type.TYPE_INT),
            label="metrics_artifact_type",
        ),
        Column(
            key=AttributeKey(name="max_install_size", type=AttributeKey.Type.TYPE_INT),
            label="max_install_size",
        ),
        Column(
            key=AttributeKey(name="max_download_size", type=AttributeKey.Type.TYPE_INT),
            label="max_download_size",
        ),
        Column(
            key=AttributeKey(name="min_install_size", type=AttributeKey.Type.TYPE_INT),
            label="min_install_size",
        ),
        Column(
            key=AttributeKey(name="min_download_size", type=AttributeKey.Type.TYPE_INT),
            label="min_download_size",
        ),
        # Artifact attributes
        Column(
            key=AttributeKey(name="artifact_type", type=AttributeKey.Type.TYPE_INT),
            label="artifact_type",
        ),
        Column(
            key=AttributeKey(name="artifact_state", type=AttributeKey.Type.TYPE_INT),
            label="artifact_state",
        ),
        Column(
            key=AttributeKey(name="app_id", type=AttributeKey.Type.TYPE_STRING),
            label="app_id",
        ),
        Column(
            key=AttributeKey(name="app_name", type=AttributeKey.Type.TYPE_STRING),
            label="app_name",
        ),
        Column(
            key=AttributeKey(name="build_version", type=AttributeKey.Type.TYPE_STRING),
            label="build_version",
        ),
        Column(
            key=AttributeKey(name="build_number", type=AttributeKey.Type.TYPE_INT),
            label="build_number",
        ),
        Column(
            key=AttributeKey(name="main_binary_identifier", type=AttributeKey.Type.TYPE_STRING),
            label="main_binary_identifier",
        ),
        Column(
            key=AttributeKey(name="artifact_date_built", type=AttributeKey.Type.TYPE_INT),
            label="artifact_date_built",
        ),
        # Build configuration
        Column(
            key=AttributeKey(name="build_configuration_name", type=AttributeKey.Type.TYPE_STRING),
            label="build_configuration_name",
        ),
        # Git attributes
        Column(
            key=AttributeKey(name="git_head_sha", type=AttributeKey.Type.TYPE_STRING),
            label="git_head_sha",
        ),
        Column(
            key=AttributeKey(name="git_base_sha", type=AttributeKey.Type.TYPE_STRING),
            label="git_base_sha",
        ),
        Column(
            key=AttributeKey(name="git_provider", type=AttributeKey.Type.TYPE_STRING),
            label="git_provider",
        ),
        Column(
            key=AttributeKey(name="git_head_repo_name", type=AttributeKey.Type.TYPE_STRING),
            label="git_head_repo_name",
        ),
        Column(
            key=AttributeKey(name="git_base_repo_name", type=AttributeKey.Type.TYPE_STRING),
            label="git_base_repo_name",
        ),
        Column(
            key=AttributeKey(name="git_head_ref", type=AttributeKey.Type.TYPE_STRING),
            label="git_head_ref",
        ),
        Column(
            key=AttributeKey(name="git_base_ref", type=AttributeKey.Type.TYPE_STRING),
            label="git_base_ref",
        ),
        Column(
            key=AttributeKey(name="git_pr_number", type=AttributeKey.Type.TYPE_INT),
            label="git_pr_number",
        ),
        # Standard timestamp
        Column(
            key=AttributeKey(name="sentry.timestamp", type=AttributeKey.Type.TYPE_DOUBLE),
            label="timestamp",
        ),
    ]

    query_filter = None
    filter_list = _build_filters(filters) if filters else []
    if filter_list:
        query_filter = TraceItemFilter(and_filter=AndFilter(filters=filter_list))

    rpc_request = TraceItemTableRequest(
        meta=RequestMeta(
            referrer="preprod.eap.debug",
            organization_id=organization_id,
            project_ids=project_ids,
            trace_item_type=TraceItemType.TRACE_ITEM_TYPE_PREPROD,
            start_timestamp=start_timestamp,
            end_timestamp=end_timestamp,
            downsampled_storage_config=DownsampledStorageConfig(
                mode=DownsampledStorageConfig.MODE_HIGHEST_ACCURACY
            ),
        ),
        filter=query_filter,
        columns=columns,
        order_by=[
            TraceItemTableRequest.OrderBy(
                column=Column(
                    label="timestamp",
                    key=AttributeKey(
                        name="sentry.timestamp",
                        type=AttributeKey.Type.TYPE_DOUBLE,
                    ),
                ),
                descending=True,
            )
        ],
        limit=limit,
        page_token=PageToken(offset=offset),
    )

    responses = snuba_rpc.table_rpc([rpc_request])
    if not responses:
        raise ValueError("No response from Snuba RPC")
    return responses[0]


def _build_filters(filters: PreprodSizeFilters) -> list[TraceItemFilter]:
    result = []

    for field_name, value in filters.__dict__.items():
        if value is None:
            continue

        # Special case: artifact_id needs to be converted to trace_id format
        if field_name == "artifact_id":
            trace_id = f"{value:032x}"
            result.append(
                TraceItemFilter(
                    comparison_filter=ComparisonFilter(
                        key=AttributeKey(
                            name="sentry.trace_id", type=AttributeKey.Type.TYPE_STRING
                        ),
                        op=ComparisonFilter.OP_EQUALS,
                        value=AttributeValue(val_str=trace_id),
                    )
                )
            )
            continue

        attr_type = _FIELD_TYPES.get(field_name)
        if attr_type is None:
            raise ValueError(f"Field '{field_name}' is missing from _FIELD_TYPES mapping.")

        if attr_type == AttributeKey.Type.TYPE_STRING:
            attr_value = AttributeValue(val_str=value)
        elif attr_type == AttributeKey.Type.TYPE_INT:
            attr_value = AttributeValue(val_int=value)
        elif attr_type == AttributeKey.Type.TYPE_DOUBLE:
            attr_value = AttributeValue(val_double=value)
        elif attr_type == AttributeKey.Type.TYPE_FLOAT:
            attr_value = AttributeValue(val_float=value)
        elif attr_type == AttributeKey.Type.TYPE_BOOLEAN:
            attr_value = AttributeValue(val_bool=value)
        else:
            raise ValueError(f"Unhandled AttributeKey type {attr_type} for field '{field_name}'.")

        result.append(
            TraceItemFilter(
                comparison_filter=ComparisonFilter(
                    key=AttributeKey(name=field_name, type=attr_type),
                    op=ComparisonFilter.OP_EQUALS,
                    value=attr_value,
                )
            )
        )

    return result
