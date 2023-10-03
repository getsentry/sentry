from __future__ import annotations

import random
import uuid
from datetime import datetime
from functools import lru_cache
from typing import Any, Mapping, MutableMapping, Tuple

import msgpack
import sentry_sdk
from arroyo.backends.kafka import KafkaPayload, KafkaProducer, build_kafka_configuration
from arroyo.dlq import InvalidMessage
from arroyo.processing.strategies import CommitOffsets, Produce
from arroyo.processing.strategies.abstract import ProcessingStrategy, ProcessingStrategyFactory
from arroyo.types import BrokerValue, Commit, Message, Partition, Topic
from django.conf import settings

from sentry import quotas
from sentry.models import Organization, Project
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
SPAN_SCHEMA_V1 = 1
SPAN_SCHEMA_VERSION = SPAN_SCHEMA_V1
DEFAULT_SPAN_RETENTION_DAYS = 90


@lru_cache(maxsize=10000)
def get_organization(project_id: int) -> Tuple[Organization, int]:
    project = Project.objects.get_from_cache(id=project_id)
    organization = project.organization
    retention_days = (
        quotas.backend.get_event_retention(
            organization=organization,
        )
        or DEFAULT_SPAN_RETENTION_DAYS
    )
    return organization.id, retention_days


def _process_relay_span_v0(relay_span: Mapping[str, Any]) -> MutableMapping[str, Any]:
    span_data: Mapping[str, Any] = relay_span.get("sentry_tags", {})

    snuba_span: MutableMapping[str, Any] = {}
    snuba_span["event_id"] = relay_span["event_id"]
    snuba_span["exclusive_time_ms"] = int(relay_span.get("exclusive_time", 0))
    snuba_span["is_segment"] = relay_span.get("is_segment", False)
    snuba_span["parent_span_id"] = relay_span.get("parent_span_id", "0")
    snuba_span["project_id"] = relay_span["project_id"]
    snuba_span["segment_id"] = relay_span.get("segment_id", "0")
    snuba_span["span_id"] = relay_span.get("span_id", "0")
    snuba_span["tags"] = {
        k: str(v) for k, v in (relay_span.get("tags", {}) or {}).items() if v is not None
    }
    snuba_span["trace_id"] = uuid.UUID(relay_span["trace_id"]).hex
    snuba_span["version"] = SPAN_SCHEMA_VERSION

    if (description := relay_span.get("description")) is not None:
        snuba_span["description"] = description

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
            tag_value = span_data.get(relay_tag)
            if snuba_tag == "group":
                if tag_value is None:
                    metrics.incr("spans.missing_group")
                else:
                    try:
                        # Test if the value is valid hexadecimal.
                        _ = int(tag_value, 16)
                        # If valid, set the raw value to the tag.
                        sentry_tags["group"] = tag_value
                    except ValueError:
                        metrics.incr("spans.invalid_group")
            elif tag_value is not None:
                sentry_tags[snuba_tag] = tag_value

    if "op" not in sentry_tags and (op := relay_span.get("op", "")) is not None:
        sentry_tags["op"] = op

    if "status" not in sentry_tags and (status := relay_span.get("status", "")) is not None:
        sentry_tags["status"] = status

    snuba_span["sentry_tags"] = {k: str(v) for k, v in sentry_tags.items()}

    _process_group_raw(snuba_span, span_data.get("transaction", ""))

    return snuba_span


def _process_group_raw(snuba_span: MutableMapping[str, Any], transaction: str) -> None:
    grouping_config = load_span_grouping_config()
    snuba_span["span_grouping_config"] = {"id": grouping_config.id}

    if snuba_span["is_segment"]:
        group_raw = grouping_config.strategy.get_transaction_span_group(
            {"transaction": transaction},
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
        group_raw = grouping_config.strategy.get_span_group(span)

    try:
        _ = int(group_raw, 16)
        snuba_span["group_raw"] = group_raw
    except ValueError:
        snuba_span["group_raw"] = "0"
        metrics.incr("spans.invalid_group_raw")


def _format_event_id(payload: Mapping[str, Any]) -> str:
    event_id = payload.get("event_id")
    if event_id:
        return uuid.UUID(event_id).hex
    return ""


def _deserialize_payload(payload: bytes) -> Mapping[str, Any]:
    # We're migrating the payload from being encoded in msgpack to JSON.
    # This for backward compatibility while we transition.
    try:
        return msgpack.unpackb(payload)
    except msgpack.FormatError:
        return json.loads(payload, use_rapid_json=True)


def _process_message(message: Message[KafkaPayload]) -> KafkaPayload:
    payload = _deserialize_payload(message.payload.value)
    relay_span = payload["span"]
    relay_span["project_id"] = payload["project_id"]
    relay_span["event_id"] = _format_event_id(payload)

    organization_id = payload.get("organization_id")
    retention_days = payload.get("retention_days")

    if not organization_id or not retention_days:
        organization_id, retention_days = get_organization(
            relay_span["project_id"],
        )

    if "sentry_tags" not in relay_span and "data" in relay_span:
        relay_span["sentry_tags"] = relay_span.pop("data")

    relay_span["organization_id"] = organization_id
    relay_span["retention_days"] = retention_days

    snuba_span = _process_relay_span_v0(relay_span)
    snuba_payload = json.dumps(snuba_span).encode("utf-8")
    return KafkaPayload(key=None, value=snuba_payload, headers=[])


def process_message(message: Message[KafkaPayload]) -> KafkaPayload:
    try:
        return _process_message(message)
    except Exception as e:
        metrics.incr("spans.consumer.message_processing_error")
        if random.random() < 0.05:
            sentry_sdk.capture_exception(e)
        assert isinstance(message.value, BrokerValue)
        raise InvalidMessage(
            message.value.partition,
            message.value.offset,
        )


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
