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
from sentry_protos.snuba.v1.trace_item_filter_pb2 import TraceItemFilter

from sentry.search.eap import constants
from sentry.search.eap.columns import ResolvedAttribute, datetime_processor
from sentry.utils import snuba_rpc

PREPROD_SIZE_ATTRIBUTE_DEFINITIONS = {
    column.public_alias: column
    for column in [
        ResolvedAttribute(
            public_alias="preprod_artifact_id",
            internal_name="preprod_artifact_id",
            search_type="integer",
        ),
        ResolvedAttribute(
            public_alias="size_metric_id",
            internal_name="size_metric_id",
            search_type="integer",
        ),
        ResolvedAttribute(
            public_alias="metrics_artifact_type",
            internal_name="metrics_artifact_type",
            search_type="integer",
        ),
        ResolvedAttribute(
            public_alias="max_install_size",
            internal_name="max_install_size",
            search_type="integer",
        ),
        ResolvedAttribute(
            public_alias="max_download_size",
            internal_name="max_download_size",
            search_type="integer",
        ),
        ResolvedAttribute(
            public_alias="min_install_size",
            internal_name="min_install_size",
            search_type="integer",
        ),
        ResolvedAttribute(
            public_alias="min_download_size",
            internal_name="min_download_size",
            search_type="integer",
        ),
        ResolvedAttribute(
            public_alias="artifact_type",
            internal_name="artifact_type",
            search_type="integer",
        ),
        ResolvedAttribute(
            public_alias="artifact_state",
            internal_name="artifact_state",
            search_type="integer",
        ),
        ResolvedAttribute(
            public_alias="app_id",
            internal_name="app_id",
            search_type="string",
        ),
        ResolvedAttribute(
            public_alias="app_name",
            internal_name="app_name",
            search_type="string",
        ),
        ResolvedAttribute(
            public_alias="build_version",
            internal_name="build_version",
            search_type="string",
        ),
        ResolvedAttribute(
            public_alias="build_number",
            internal_name="build_number",
            search_type="integer",
        ),
        ResolvedAttribute(
            public_alias="main_binary_identifier",
            internal_name="main_binary_identifier",
            search_type="string",
        ),
        ResolvedAttribute(
            public_alias="artifact_date_built",
            internal_name="artifact_date_built",
            search_type="integer",
        ),
        ResolvedAttribute(
            public_alias="build_configuration_name",
            internal_name="build_configuration_name",
            search_type="string",
        ),
        ResolvedAttribute(
            public_alias="git_head_sha",
            internal_name="git_head_sha",
            search_type="string",
        ),
        ResolvedAttribute(
            public_alias="git_base_sha",
            internal_name="git_base_sha",
            search_type="string",
        ),
        ResolvedAttribute(
            public_alias="git_provider",
            internal_name="git_provider",
            search_type="string",
        ),
        ResolvedAttribute(
            public_alias="git_head_repo_name",
            internal_name="git_head_repo_name",
            search_type="string",
        ),
        ResolvedAttribute(
            public_alias="git_base_repo_name",
            internal_name="git_base_repo_name",
            search_type="string",
        ),
        ResolvedAttribute(
            public_alias="git_head_ref",
            internal_name="git_head_ref",
            search_type="string",
        ),
        ResolvedAttribute(
            public_alias="git_base_ref",
            internal_name="git_base_ref",
            search_type="string",
        ),
        ResolvedAttribute(
            public_alias="git_pr_number",
            internal_name="git_pr_number",
            search_type="integer",
        ),
        ResolvedAttribute(
            public_alias="timestamp",
            internal_name="sentry.timestamp",
            internal_type=constants.DOUBLE,
            search_type="string",
            processor=datetime_processor,
        ),
    ]
}


def query_preprod_size_metrics(
    organization_id: int,
    project_ids: list[int],
    start: datetime,
    end: datetime,
    referrer: str,
    filter: TraceItemFilter | None = None,
    columns: list[str] | None = None,
    limit: int = 100,
    offset: int = 0,
) -> TraceItemTableResponse:
    """
    Query preprod size metrics from EAP.

    Args:
        referrer: Identifier for the calling endpoint (e.g., "api.preprod.app-size-stats").
        filter: Optional TraceItemFilter for filtering results. Build using proto types directly.
        columns: List of column names to include. If None, returns all available columns.

    Example:
        # With filter
        app_filter = TraceItemFilter(
            comparison_filter=ComparisonFilter(
                key=AttributeKey(name="app_id", type=AttributeKey.Type.TYPE_STRING),
                op=ComparisonFilter.OP_EQUALS,
                value=AttributeValue(val_str="com.example.app"),
            )
        )

        query_preprod_size_metrics(
            organization_id=1,
            project_ids=[1, 2],
            start=datetime.now() - timedelta(days=30),
            end=datetime.now(),
            referrer="api.preprod.app-size-stats",
            filter=app_filter,
            columns=["app_id", "build_version", "max_install_size", "timestamp"],
        )
    """
    start_timestamp = Timestamp()
    start_timestamp.FromDatetime(start)

    end_timestamp = Timestamp()
    end_timestamp.FromDatetime(end)

    columns_list = _get_columns_for_preprod_size(columns)

    # Ensure timestamp is always included since it's part of our order_by
    timestamp_col = Column(
        label="timestamp",
        key=AttributeKey(
            name="sentry.timestamp",
            type=AttributeKey.Type.TYPE_DOUBLE,
        ),
    )
    has_timestamp = any(col.label == "timestamp" for col in columns_list)
    if not has_timestamp:
        columns_list.append(timestamp_col)

    rpc_request = TraceItemTableRequest(
        meta=RequestMeta(
            referrer=referrer,
            cogs_category="preprod_size_analysis",
            organization_id=organization_id,
            project_ids=project_ids,
            trace_item_type=TraceItemType.TRACE_ITEM_TYPE_PREPROD,
            start_timestamp=start_timestamp,
            end_timestamp=end_timestamp,
            downsampled_storage_config=DownsampledStorageConfig(
                mode=DownsampledStorageConfig.MODE_HIGHEST_ACCURACY
            ),
        ),
        filter=filter,
        columns=columns_list,
        order_by=[
            TraceItemTableRequest.OrderBy(
                column=timestamp_col,
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


def _get_columns_for_preprod_size(column_names: list[str] | None = None) -> list[Column]:
    """Convert column names to Column objects. If column_names is None, returns all columns."""
    if column_names is None:
        column_names = list(PREPROD_SIZE_ATTRIBUTE_DEFINITIONS.keys())

    columns = []
    for name in column_names:
        if name not in PREPROD_SIZE_ATTRIBUTE_DEFINITIONS:
            raise ValueError(
                f"Unknown column '{name}'. Available columns: {sorted(PREPROD_SIZE_ATTRIBUTE_DEFINITIONS.keys())}"
            )
        col = PREPROD_SIZE_ATTRIBUTE_DEFINITIONS[name]
        columns.append(Column(label=col.public_alias, key=col.proto_definition))

    return columns
