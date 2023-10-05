from __future__ import annotations

import random
import uuid
from datetime import datetime
from typing import Any, Mapping, MutableMapping, Optional

import sentry_sdk
from arroyo.backends.kafka import KafkaPayload, KafkaProducer, build_kafka_configuration
from arroyo.processing.strategies import CommitOffsets, Produce
from arroyo.processing.strategies.abstract import ProcessingStrategy, ProcessingStrategyFactory
from arroyo.types import FILTERED_PAYLOAD, Commit, FilteredPayload, Message, Partition, Topic
from django.conf import settings
from sentry_kafka_schemas import get_codec
from sentry_kafka_schemas.codecs import Codec, ValidationError
from sentry_kafka_schemas.schema_types.ingest_spans_v1 import IngestSpanMessage

from sentry.spans.grouping.api import load_span_grouping_config
from sentry.spans.grouping.strategy.base import Span
from sentry.utils import json, metrics
from sentry.utils.arroyo import RunTaskWithMultiprocessing
from sentry.utils.kafka_config import get_kafka_producer_cluster_options, get_topic_definition

SPAN_SCHEMA_V1 = 1
SPAN_SCHEMA_VERSION = SPAN_SCHEMA_V1
SPAN_SCHEMA: Codec[IngestSpanMessage] = get_codec("ingest-spans")


def _process_relay_span_v1(relay_span: Mapping[str, Any]) -> MutableMapping[str, Any]:
    snuba_span: MutableMapping[str, Any] = {}
    snuba_span["exclusive_time_ms"] = int(relay_span.get("exclusive_time", 0))
    snuba_span["is_segment"] = relay_span.get("is_segment", False)
    snuba_span["organization_id"] = relay_span["organization_id"]
    snuba_span["parent_span_id"] = relay_span.get("parent_span_id", "0")
    snuba_span["project_id"] = relay_span["project_id"]
    snuba_span["retention_days"] = relay_span["retention_days"]
    snuba_span["segment_id"] = relay_span.get("segment_id", "0")
    snuba_span["span_id"] = relay_span.get("span_id", "0")
    snuba_span["trace_id"] = uuid.UUID(relay_span["trace_id"]).hex
    snuba_span["version"] = SPAN_SCHEMA_VERSION

    for key in {"description", "tags"}:
        if value := relay_span.get(key):
            snuba_span[key] = value

    # Copy optional event IDs to the Snuba span
    for key in {"event_id", "profile_id"}:
        if value := _format_event_id(relay_span, key=key):
            snuba_span[key] = value

    start_timestamp = datetime.utcfromtimestamp(relay_span["start_timestamp"])
    snuba_span["start_timestamp_ms"] = int(start_timestamp.timestamp() * 1e3)
    end_timestamp = datetime.utcfromtimestamp(relay_span["timestamp"])
    snuba_span["duration_ms"] = max(
        int((end_timestamp - start_timestamp).total_seconds() * 1e3),
        0,
    )

    sentry_tags: dict[str, Any] = relay_span.get("sentry_tags", {}) or {}

    # Check for top-level we need to add to sentry_tags
    for key in {"op", "status"}:
        if key not in sentry_tags and (value := relay_span.get(key)):
            sentry_tags[key] = value

    snuba_span["sentry_tags"] = sentry_tags

    _process_group_raw(snuba_span, sentry_tags.get("transaction", ""))

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


def _format_event_id(payload: Mapping[str, Any], key="event_id") -> Optional[str]:
    event_id = payload.get(key)
    if event_id:
        return uuid.UUID(event_id).hex
    return None


def _deserialize_payload(payload: bytes) -> Mapping[str, Any]:
    return SPAN_SCHEMA.decode(payload)


def _process_message(message: Message[KafkaPayload]) -> KafkaPayload:
    payload = _deserialize_payload(message.payload.value)
    relay_span = payload["span"]
    relay_span["event_id"] = payload.get("event_id")
    relay_span["organization_id"] = payload["organization_id"]
    relay_span["project_id"] = payload["project_id"]
    relay_span["retention_days"] = payload["retention_days"]

    snuba_span = _process_relay_span_v1(relay_span)
    snuba_payload = json.dumps(snuba_span).encode("utf-8")
    return KafkaPayload(key=None, value=snuba_payload, headers=[])


def _capture_exception(err: Exception) -> None:
    if random.random() < 0.05:
        sentry_sdk.capture_exception(err)


def process_message(message: Message[KafkaPayload]) -> KafkaPayload | FilteredPayload:
    try:
        return _process_message(message)
    except ValidationError as err:
        metrics.incr("spans.consumer.schema_validation.failed")
        _capture_exception(err)
        return FILTERED_PAYLOAD
    except Exception as err:
        metrics.incr("spans.consumer.message_processing_error")
        _capture_exception(err)
        return FILTERED_PAYLOAD


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
