from __future__ import annotations

from datetime import datetime

from google.protobuf.timestamp_pb2 import Timestamp
from sentry_protos.snuba.v1.downsampled_storage_pb2 import DownsampledStorageConfig
from sentry_protos.snuba.v1.endpoint_trace_item_table_pb2 import (
    Column,
    TraceItemTableRequest,
    TraceItemTableResponse,
)
from sentry_protos.snuba.v1.request_common_pb2 import PageToken, RequestMeta, TraceItemType
from sentry_protos.snuba.v1.trace_item_attribute_pb2 import AttributeKey

from sentry.utils import snuba_rpc


def query_preprod_size_metrics(
    organization_id: int,
    project_ids: list[int],
    start: datetime,
    end: datetime,
    limit: int = 100,
    offset: int = 0,
) -> TraceItemTableResponse:
    """
    Query preprod size metrics from EAP.

    Returns all available attributes for the given time range.
    """
    # Convert datetime to protobuf Timestamp
    start_timestamp = Timestamp()
    start_timestamp.FromDatetime(start)

    end_timestamp = Timestamp()
    end_timestamp.FromDatetime(end)

    # Define columns to retrieve - all the preprod attributes
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

    return snuba_rpc.table_rpc([rpc_request])[0]
