from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from arroyo import Topic as ArroyoTopic
from arroyo.backends.kafka import KafkaPayload
from google.protobuf.timestamp_pb2 import Timestamp
from sentry_protos.snuba.v1.request_common_pb2 import TraceItemType
from sentry_protos.snuba.v1.trace_item_pb2 import TraceItem as EAPTraceItem

from sentry.conf.types.kafka_definition import Topic
from sentry.preprod.models import PreprodArtifactSizeMetrics
from sentry.replays.lib.kafka import EAP_ITEMS_CODEC, eap_producer
from sentry.search.eap.rpc_utils import anyvalue
from sentry.utils.kafka_config import get_topic_definition


def write_preprod_size_metric_to_eap(
    size_metric: PreprodArtifactSizeMetrics,
    organization_id: int,
    project_id: int,
) -> None:
    """
    Write a PreprodArtifactSizeMetrics to EAP as a TRACE_ITEM_TYPE_PREPROD trace item.

    NOTE: EAP is append-only, so this function should only be called after the size metric has been successfully committed
    since we cannot update fields later on.
    """
    proto_timestamp = Timestamp()
    proto_timestamp.FromDatetime(size_metric.date_added)

    received = Timestamp()
    received.FromDatetime(size_metric.date_added)

    artifact = size_metric.preprod_artifact

    # Generate a unique trace_id for this preprod artifact
    # Design: Use preprod_artifact_id to group related components of the SAME build
    # (e.g., main app + Watch extension + dynamic features) under one trace.
    # We don't use git_head_sha because multiple unrelated apps could be uploaded
    # to the same commit (like a monorepo), and grouping them would be confusing.
    # Users can still query by git_head_sha as an attribute if needed.
    #
    # Format: 32-character hex string (OpenTelemetry trace ID format)
    # We use the artifact_id as the base, padded to 32 hex characters
    trace_id = f"{size_metric.preprod_artifact_id:032x}"

    # Generate a unique item_id for this specific size metric
    # Convert to 16 bytes in little-endian format (consistent with span item_id format)
    item_id = uuid.uuid4().bytes

    attributes: dict[str, Any] = {
        "preprod_artifact_id": size_metric.preprod_artifact_id,
        "size_metric_id": size_metric.id,
        "metrics_artifact_type": size_metric.metrics_artifact_type,
    }

    if size_metric.identifier is not None:
        attributes["identifier"] = size_metric.identifier

    if size_metric.min_install_size is not None:
        attributes["min_install_size"] = size_metric.min_install_size

    if size_metric.max_install_size is not None:
        attributes["max_install_size"] = size_metric.max_install_size

    if size_metric.min_download_size is not None:
        attributes["min_download_size"] = size_metric.min_download_size

    if size_metric.max_download_size is not None:
        attributes["max_download_size"] = size_metric.max_download_size

    if size_metric.processing_version is not None:
        attributes["processing_version"] = size_metric.processing_version

    if size_metric.analysis_file_id is not None:
        attributes["analysis_file_id"] = size_metric.analysis_file_id

    # PreprodArtifact fields
    attributes["artifact_state"] = artifact.state

    if artifact.artifact_type is not None:
        attributes["artifact_type"] = artifact.artifact_type

    if artifact.app_id is not None:
        attributes["app_id"] = artifact.app_id

    if artifact.app_name is not None:
        attributes["app_name"] = artifact.app_name

    if artifact.build_version is not None:
        attributes["build_version"] = artifact.build_version

    if artifact.build_number is not None:
        attributes["build_number"] = artifact.build_number

    if artifact.main_binary_identifier is not None:
        attributes["main_binary_identifier"] = artifact.main_binary_identifier

    if artifact.date_built is not None:
        # Convert datetime to unix timestamp for easier querying
        attributes["artifact_date_built"] = int(artifact.date_built.timestamp())

    # PreprodBuildConfiguration fields
    if artifact.build_configuration is not None:
        attributes["build_configuration_name"] = artifact.build_configuration.name

    # CommitComparison fields
    if artifact.commit_comparison is not None:
        commit_comparison = artifact.commit_comparison
        attributes["git_head_sha"] = commit_comparison.head_sha

        if commit_comparison.base_sha is not None:
            attributes["git_base_sha"] = commit_comparison.base_sha

        if commit_comparison.provider is not None:
            attributes["git_provider"] = commit_comparison.provider

        if commit_comparison.head_repo_name is not None:
            attributes["git_head_repo_name"] = commit_comparison.head_repo_name

        if commit_comparison.base_repo_name is not None:
            attributes["git_base_repo_name"] = commit_comparison.base_repo_name

        if commit_comparison.head_ref is not None:
            attributes["git_head_ref"] = commit_comparison.head_ref

        if commit_comparison.base_ref is not None:
            attributes["git_base_ref"] = commit_comparison.base_ref

        if commit_comparison.pr_number is not None:
            attributes["git_pr_number"] = commit_comparison.pr_number

    trace_item = EAPTraceItem(
        organization_id=organization_id,
        project_id=project_id,
        item_type=TraceItemType.TRACE_ITEM_TYPE_PREPROD,
        timestamp=proto_timestamp,
        trace_id=trace_id,
        item_id=item_id,
        received=received,
        retention_days=90,  # Default retention for preprod data
        attributes={k: anyvalue(v) for k, v in attributes.items()},
        client_sample_rate=1.0,
        server_sample_rate=1.0,
    )

    topic = get_topic_definition(Topic.SNUBA_ITEMS)["real_topic_name"]
    payload = KafkaPayload(None, EAP_ITEMS_CODEC.encode(trace_item), [])
    eap_producer.produce(ArroyoTopic(topic), payload)
