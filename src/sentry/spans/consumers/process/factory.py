from __future__ import annotations

import random
import uuid
from datetime import datetime
from typing import Any, Mapping, MutableMapping, Optional

import msgpack
import sentry_sdk
from arroyo.backends.kafka import KafkaPayload, KafkaProducer, build_kafka_configuration
from arroyo.processing.strategies import CommitOffsets, Produce
from arroyo.processing.strategies.abstract import ProcessingStrategy, ProcessingStrategyFactory
from arroyo.types import Commit, Message, Partition, Topic
from django.conf import settings

from sentry import quotas
from sentry.models import Project
from sentry.spans.grouping.api import load_span_grouping_config
from sentry.spans.grouping.strategy.base import Span
from sentry.utils import json, metrics
from sentry.utils.arroyo import RunTaskWithMultiprocessing
from sentry.utils.kafka_config import get_kafka_producer_cluster_options, get_topic_definition

TAG_MAPPING = {
    "span.action": "action",
    "span.description": "description",
    "span.domain": "domain",
    "span.group": "group",
    "span.module": "module",
    "span.op": "op",
    "span.status": "status",
    "span.status_code": "status_code",
    "span.system": "system",
    "transaction": "transaction",
    "transaction.method": "transaction.method",
    "transaction.op": "transaction.op",
}
SPAN_SCHEMA_VERSION = 1
DEFAULT_SPAN_RETENTION_DAYS = 90


def _build_snuba_span(relay_span: Mapping[str, Any]) -> MutableMapping[str, Any]:
    project = Project.objects.get_from_cache(id=relay_span["project_id"])
    organization = project.organization
    retention_days = (
        quotas.backend.get_event_retention(
            organization=organization,
        )
        or DEFAULT_SPAN_RETENTION_DAYS
    )

    span_data: Mapping[str, Any] = relay_span.get("data", {})

    snuba_span: MutableMapping[str, Any] = {}
    snuba_span["description"] = relay_span.get("description")
    snuba_span["event_id"] = relay_span["event_id"]
    snuba_span["exclusive_time_ms"] = int(relay_span.get("exclusive_time", 0))
    snuba_span["is_segment"] = relay_span.get("is_segment", False)
    snuba_span["organization_id"] = organization.id
    snuba_span["parent_span_id"] = relay_span.get("parent_span_id", "0")
    snuba_span["project_id"] = relay_span["project_id"]
    snuba_span["retention_days"] = retention_days
    snuba_span["segment_id"] = relay_span.get("segment_id", "0")
    snuba_span["span_id"] = relay_span.get("span_id", "0")
    snuba_span["tags"] = relay_span.get("tags")
    snuba_span["trace_id"] = uuid.UUID(relay_span["trace_id"]).hex
    snuba_span["version"] = SPAN_SCHEMA_VERSION

    start_timestamp = datetime.utcfromtimestamp(relay_span["start_timestamp"])
    snuba_span["start_timestamp_ms"] = int(start_timestamp.timestamp() * 1e3)
    end_timestamp = datetime.utcfromtimestamp(relay_span["timestamp"])
    snuba_span["duration_ms"] = max(
        int((end_timestamp - start_timestamp).total_seconds() * 1e3),
        0,
    )

    sentry_tags: MutableMapping[str, Any] = {}

    if span_data:
        for relay_tag, snuba_tag in TAG_MAPPING.items():
            if relay_tag in span_data:
                sentry_tags[snuba_tag] = span_data.get(relay_tag)

    if "op" not in sentry_tags:
        sentry_tags["op"] = relay_span.get("op", "")

    if "status" not in sentry_tags:
        sentry_tags["status"] = relay_span.get("status", "")

    snuba_span["sentry_tags"] = sentry_tags

    grouping_config = load_span_grouping_config()

    if snuba_span["is_segment"]:
        group = grouping_config.strategy.get_transaction_span_group(
            {"transaction": span_data.get("transaction", "")},
        )
    else:
        # Build a span with only necessary values filled.
        span = Span(
            op=snuba_span.get("op", ""),
            description=snuba_span.get("description", ""),
            fingerprint=None,
            trace_id="",
            parent_span_id="",
            span_id="",
            start_timestamp=0,
            timestamp=0,
            tags=None,
            data=None,
            same_process_as_parent=True,
        )
        group = grouping_config.strategy.get_span_group(span)

    snuba_span["group_raw"] = group or "0"
    snuba_span["span_grouping_config"] = {"id": grouping_config.id}

    return snuba_span


def _format_event_id(payload: Mapping[str, Any]) -> str:
    event_id = payload.get("event_id")
    if event_id:
        return uuid.UUID(event_id).hex
    return ""


def _process_message(message: Message[KafkaPayload]) -> KafkaPayload:
    payload = msgpack.unpackb(message.payload.value)
    relay_span = payload["span"]
    relay_span["project_id"] = payload["project_id"]
    relay_span["event_id"] = _format_event_id(payload)
    snuba_span = _build_snuba_span(relay_span)
    snuba_payload = json.dumps(snuba_span).encode("utf-8")
    return KafkaPayload(key=None, value=snuba_payload, headers=[])


def process_message(message: Message[KafkaPayload]) -> Optional[KafkaPayload]:
    try:
        return _process_message(message)
    except Exception as e:
        metrics.incr("spans.consumer.message_processing_error")
        if random.random() < 0.05:
            sentry_sdk.capture_exception(e)
    return None


class ProcessSpansStrategyFactory(ProcessingStrategyFactory[KafkaPayload]):
    def __init__(
        self,
        output_topic: str,
        num_processes: int,
        max_batch_size: int,
        max_batch_time: int,
        input_block_size: int,
        output_block_size: int,
    ):
        super().__init__()

        self.__num_processes = num_processes
        self.__max_batch_size = max_batch_size
        self.__max_batch_time = max_batch_time
        self.__input_block_size = input_block_size
        self.__output_block_size = output_block_size

        cluster_name = get_topic_definition(
            settings.KAFKA_INGEST_SPANS,
        )["cluster"]
        producer_config = get_kafka_producer_cluster_options(cluster_name)
        self.__producer = KafkaProducer(
            build_kafka_configuration(
                default_config=producer_config,
            )
        )
        self.__output_topic = Topic(name=output_topic)

    def create_with_partitions(
        self,
        commit: Commit,
        partitions: Mapping[Partition, int],
    ) -> ProcessingStrategy[KafkaPayload]:
        next_step = Produce(
            producer=self.__producer,
            topic=self.__output_topic,
            next_step=CommitOffsets(commit),
            max_buffer_size=100000,
        )
        return RunTaskWithMultiprocessing(
            num_processes=self.__num_processes,
            max_batch_size=self.__max_batch_size,
            max_batch_time=self.__max_batch_time,
            input_block_size=self.__input_block_size,
            output_block_size=self.__output_block_size,
            function=process_message,
            next_step=next_step,
        )

    def shutdown(self) -> None:
        self.__producer.close()
