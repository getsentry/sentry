from __future__ import annotations

import uuid
from dataclasses import dataclass, field, fields
from datetime import datetime

from google.protobuf.timestamp_pb2 import Timestamp
from sentry_protos.snuba.v1.downsampled_storage_pb2 import DownsampledStorageConfig
from sentry_protos.snuba.v1.endpoint_trace_item_table_pb2 import (
    Column,
    TraceItemTableRequest,
    TraceItemTableResponse,
)
from sentry_protos.snuba.v1.request_common_pb2 import PageToken, RequestMeta, TraceItemType
from sentry_protos.snuba.v1.trace_item_attribute_pb2 import AttributeKey, AttributeValue
from sentry_protos.snuba.v1.trace_item_filter_pb2 import (
    AndFilter,
    ComparisonFilter,
    TraceItemFilter,
)

from sentry.preprod.eap.constants import PREPROD_NAMESPACE
from sentry.search.eap import constants
from sentry.search.eap.columns import ResolvedAttribute
from sentry.search.eap.rpc_utils import create_attribute_value
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
        ),
    ]
}


@dataclass
class PreprodSizeFilters:
    # IDs (handled specially - converted to trace_id)
    artifact_id: int | None = None

    # App/Artifact attributes
    app_id: str | None = field(
        default=None, metadata={"attr_type": AttributeKey.Type.TYPE_STRING}
    )
    artifact_type: int | None = field(
        default=None, metadata={"attr_type": AttributeKey.Type.TYPE_INT}
    )

    # Build configuration
    build_configuration_name: str | None = field(
        default=None, metadata={"attr_type": AttributeKey.Type.TYPE_STRING}
    )

    # Git attributes
    git_head_ref: str | None = field(
        default=None, metadata={"attr_type": AttributeKey.Type.TYPE_STRING}
    )
    git_head_sha: str | None = field(
        default=None, metadata={"attr_type": AttributeKey.Type.TYPE_STRING}
    )
    git_base_ref: str | None = field(
        default=None, metadata={"attr_type": AttributeKey.Type.TYPE_STRING}
    )
    git_base_sha: str | None = field(
        default=None, metadata={"attr_type": AttributeKey.Type.TYPE_STRING}
    )
    git_provider: str | None = field(
        default=None, metadata={"attr_type": AttributeKey.Type.TYPE_STRING}
    )
    git_head_repo_name: str | None = field(
        default=None, metadata={"attr_type": AttributeKey.Type.TYPE_STRING}
    )
    git_base_repo_name: str | None = field(
        default=None, metadata={"attr_type": AttributeKey.Type.TYPE_STRING}
    )
    git_pr_number: int | None = field(
        default=None, metadata={"attr_type": AttributeKey.Type.TYPE_INT}
    )


def query_preprod_size_metrics(
    organization_id: int,
    project_ids: list[int],
    start: datetime,
    end: datetime,
    filters: PreprodSizeFilters | None = None,
    columns: list[str] | None = None,
    limit: int = 100,
    offset: int = 0,
) -> TraceItemTableResponse:
    """
    Query preprod size metrics from EAP.

    Args:
        columns: List of column names to include. If None, returns all available columns.

    Example:
        query_preprod_size_metrics(
            organization_id=1,
            project_ids=[1, 2],
            start=datetime.now() - timedelta(days=30),
            end=datetime.now(),
            filters=PreprodSizeFilters(
                app_id="com.example.app",
                artifact_type=0,
                build_configuration_name="Release",
                git_head_ref="main",
            ),
            columns=["app_id", "build_version", "max_install_size", "timestamp"],
        )
    """
    start_timestamp = Timestamp()
    start_timestamp.FromDatetime(start)

    end_timestamp = Timestamp()
    end_timestamp.FromDatetime(end)

    columns_list = _get_columns_for_preprod_size(columns)

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
        columns=columns_list,
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

    for field in fields(filters):
        value = getattr(filters, field.name)
        if value is None:
            continue

        # Special case: artifact_id needs to be converted to trace_id format using UUID5
        if field.name == "artifact_id":
            trace_id = uuid.uuid5(PREPROD_NAMESPACE, str(value)).hex
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

        attr_type = field.metadata.get("attr_type")
        if attr_type is None:
            raise ValueError(
                f"Field '{field.name}' is missing 'attr_type' metadata. "
                f"Add metadata={{'attr_type': ...}} to the field definition"
            )

        result.append(
            TraceItemFilter(
                comparison_filter=ComparisonFilter(
                    key=AttributeKey(name=field.name, type=attr_type),
                    op=ComparisonFilter.OP_EQUALS,
                    value=create_attribute_value(attr_type, value),
                )
            )
        )

    return result


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
        columns.append(Column(label=col.internal_name, key=col.proto_definition))

    return columns
