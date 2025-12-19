from __future__ import annotations

import uuid
from typing import Any

from arroyo import Topic as ArroyoTopic
from arroyo.backends.kafka import KafkaPayload, KafkaProducer
from google.protobuf.timestamp_pb2 import Timestamp
from sentry_kafka_schemas.codecs import Codec
from sentry_protos.snuba.v1.request_common_pb2 import TraceItemType
from sentry_protos.snuba.v1.trace_item_pb2 import TraceItem
from sentry_protos.snuba.v1.trace_item_pb2 import TraceItem as EAPTraceItem

from sentry.conf.types.kafka_definition import Topic, get_topic_codec
from sentry.preprod.eap.constants import PREPROD_NAMESPACE
from sentry.preprod.models import PreprodArtifactSizeMetrics
from sentry.search.eap.rpc_utils import anyvalue
from sentry.utils.arroyo_producer import SingletonProducer, get_arroyo_producer
from sentry.utils.kafka_config import get_topic_definition


def produce_preprod_size_metric_to_eap(
    size_metric: PreprodArtifactSizeMetrics,
    organization_id: int,
    project_id: int,
) -> None:
    """
    Write a PreprodArtifactSizeMetrics to EAP topic as a TRACE_ITEM_TYPE_PREPROD trace item.

    NOTE: EAP is append-only, so this function should only be called after the size metric has been successfully committed
    since we cannot update fields later on. EAP does support ReplacingMergeTree deduplication,
    so we can safely write the same metric multiple times (say after reprocessing an artifact), but we shouldn't rely on that
    for mutability.
    """
    proto_timestamp = Timestamp()
    proto_timestamp.FromDatetime(size_metric.date_added)

    received = Timestamp()
    received.FromDatetime(size_metric.date_added)

    artifact = size_metric.preprod_artifact

    # Generate a unique trace_id for this preprod artifact using UUID5 with PREPROD_NAMESPACE.
    # This ensures no collision with other trace types in EAP.
    # Design: Use preprod_artifact_id to group related components of the SAME build
    # (e.g., main app + Watch extension + dynamic features) under one trace.
    trace_id = uuid.uuid5(PREPROD_NAMESPACE, str(size_metric.preprod_artifact_id)).hex

    # Generate deterministic item_id based on size_metric.id.
    # This enables ReplacingMergeTree deduplication when reprocessing the same metric.
    # Since timestamp is also deterministic (uses size_metric.date_added), rewriting
    # the same metric will result in identical (timestamp, trace_id, item_id) tuple,
    # causing ClickHouse to automatically deduplicate and keep the most recent write.
    item_id_str = f"size_metric_{size_metric.id}"
    item_id = int(uuid.uuid5(PREPROD_NAMESPACE, item_id_str).hex, 16).to_bytes(16, "little")

    attributes: dict[str, Any] = {
        "preprod_artifact_id": size_metric.preprod_artifact_id,
        "size_metric_id": size_metric.id,
        "sub_item_type": "size_metric",
        "metrics_artifact_type": size_metric.metrics_artifact_type,
        "identifier": size_metric.identifier,
        "min_install_size": size_metric.min_install_size,
        "max_install_size": size_metric.max_install_size,
        "min_download_size": size_metric.min_download_size,
        "max_download_size": size_metric.max_download_size,
        "processing_version": size_metric.processing_version,
        "analysis_file_id": size_metric.analysis_file_id,
        "artifact_state": artifact.state,
        "artifact_type": artifact.artifact_type,
        "app_id": artifact.app_id,
        "app_name": artifact.app_name,
        "build_version": artifact.build_version,
        "build_number": artifact.build_number,
        "main_binary_identifier": artifact.main_binary_identifier,
        "artifact_date_built": (
            int(artifact.date_built.timestamp()) if artifact.date_built else None
        ),
        "build_configuration_name": (
            artifact.build_configuration.name if artifact.build_configuration else None
        ),
    }

    if artifact.commit_comparison is not None:
        commit_comparison = artifact.commit_comparison
        attributes.update(
            {
                "git_head_sha": commit_comparison.head_sha,
                "git_base_sha": commit_comparison.base_sha,
                "git_provider": commit_comparison.provider,
                "git_head_repo_name": commit_comparison.head_repo_name,
                "git_base_repo_name": commit_comparison.base_repo_name,
                "git_head_ref": commit_comparison.head_ref,
                "git_base_ref": commit_comparison.base_ref,
                "git_pr_number": commit_comparison.pr_number,
            }
        )

    trace_item = EAPTraceItem(
        organization_id=organization_id,
        project_id=project_id,
        item_id=item_id,
        item_type=TraceItemType.TRACE_ITEM_TYPE_PREPROD,
        timestamp=proto_timestamp,
        trace_id=trace_id,
        received=received,
        retention_days=90,  # Default retention for preprod data
        attributes={k: anyvalue(v) for k, v in attributes.items() if v is not None},
        client_sample_rate=1.0,
        server_sample_rate=1.0,
    )

    topic = get_topic_definition(Topic.SNUBA_ITEMS)["real_topic_name"]
    payload = KafkaPayload(None, EAP_ITEMS_CODEC.encode(trace_item), [])
    _eap_producer.produce(ArroyoTopic(topic), payload)


EAP_ITEMS_CODEC: Codec[TraceItem] = get_topic_codec(Topic.SNUBA_ITEMS)


def _get_eap_items_producer() -> KafkaProducer:
    """Get a Kafka producer for EAP TraceItems."""
    return get_arroyo_producer(
        name="sentry.preprod.lib.kafka.eap_items",
        topic=Topic.SNUBA_ITEMS,
    )


_eap_producer = SingletonProducer(_get_eap_items_producer)
