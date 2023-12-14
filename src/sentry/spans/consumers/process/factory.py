from __future__ import annotations

import random
import uuid
from datetime import datetime, timezone
from typing import Any, Mapping, Optional

import sentry_sdk
from arroyo.backends.kafka import KafkaPayload, KafkaProducer, build_kafka_configuration
from arroyo.processing.strategies import CommitOffsets, Produce
from arroyo.processing.strategies.abstract import ProcessingStrategy, ProcessingStrategyFactory
from arroyo.types import FILTERED_PAYLOAD, Commit, FilteredPayload, Message, Partition, Topic
from django.conf import settings
from sentry_kafka_schemas import get_codec
from sentry_kafka_schemas.codecs import Codec, ValidationError
from sentry_kafka_schemas.schema_types.ingest_spans_v1 import IngestSpanMessage
from sentry_kafka_schemas.schema_types.snuba_spans_v1 import SpanEvent

from sentry.spans.grouping.api import load_span_grouping_config
from sentry.spans.grouping.strategy.base import Span
from sentry.utils import metrics
from sentry.utils.arroyo import MultiprocessingPool, RunTaskWithMultiprocessing
from sentry.utils.kafka_config import get_kafka_producer_cluster_options, get_topic_definition

INGEST_SPAN_SCHEMA: Codec[IngestSpanMessage] = get_codec("ingest-spans")
SNUBA_SPAN_SCHEMA: Codec[SpanEvent] = get_codec("snuba-spans")


def _process_relay_span_v1(relay_span: Mapping[str, Any]) -> SpanEvent:
    start_timestamp = datetime.utcfromtimestamp(relay_span["start_timestamp"])
    end_timestamp = datetime.utcfromtimestamp(relay_span["timestamp"])
    snuba_span: SpanEvent = SpanEvent(
        duration_ms=max(
            int((end_timestamp - start_timestamp).total_seconds() * 1e3),
            0,
        ),
        exclusive_time_ms=int(relay_span.get("exclusive_time", 0)),
        is_segment=relay_span.get("is_segment", False),
        organization_id=relay_span["organization_id"],
        parent_span_id=relay_span.get("parent_span_id", "0"),
        project_id=relay_span["project_id"],
        received=relay_span.get("received", datetime.now(tz=timezone.utc).timestamp()),
        retention_days=relay_span["retention_days"],
        segment_id=relay_span.get("segment_id", "0"),
        span_id=relay_span.get("span_id", "0"),
        start_timestamp_ms=int(start_timestamp.timestamp() * 1e3),
        trace_id=_format_event_id(relay_span["trace_id"]),
    )

    for key in {
        "_metrics_summary",
        "description",
        "measurements",
        "sentry_tags",
        "tags",
    }:
        if value := relay_span.get(key):
            snuba_span[key] = value  # type: ignore

    for key in {"event_id", "profile_id"}:
        if value := format_event_id(relay_span, key=key):
            snuba_span[key] = value  # type: ignore

    _process_group_raw(snuba_span)

    return snuba_span


def _process_group_raw(snuba_span: SpanEvent) -> None:
    grouping_config = load_span_grouping_config()
    sentry_tags = snuba_span.get("sentry_tags", {})

    if snuba_span["is_segment"]:
        group_raw = grouping_config.strategy.get_transaction_span_group(
            {"transaction": sentry_tags.get("transaction", "")},
        )
    else:
        # Build a span with only necessary values filled.
        span = Span(
            op=sentry_tags.get("op", ""),
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


def format_event_id(payload: Mapping[str, Any], key: str) -> Optional[str]:
    if event_id := payload.get(key):
        return _format_event_id(event_id)
    return None


def _format_event_id(event_id: str) -> str:
    return uuid.UUID(event_id).hex


def _deserialize_payload(payload: bytes) -> Mapping[str, Any]:
    return INGEST_SPAN_SCHEMA.decode(payload)


def _process_message(message: Message[KafkaPayload]) -> KafkaPayload | FilteredPayload:
    try:
        payload = _deserialize_payload(message.payload.value)
    except ValidationError as err:
        metrics.incr("spans.consumer.schema_validation.failed.input")
        _capture_exception(err)
        return FILTERED_PAYLOAD

    relay_span = payload["span"]
    relay_span["event_id"] = payload.get("event_id")
    relay_span["organization_id"] = payload["organization_id"]
    relay_span["project_id"] = payload["project_id"]
    relay_span["retention_days"] = payload["retention_days"]
    snuba_span = _process_relay_span_v1(relay_span)

    try:
        snuba_payload = SNUBA_SPAN_SCHEMA.encode(snuba_span)
        return KafkaPayload(key=None, value=snuba_payload, headers=[])
    except ValidationError as err:
        metrics.incr("spans.consumer.schema_validation.failed.output")
        _capture_exception(err)
        return FILTERED_PAYLOAD


def _capture_exception(err: Exception) -> None:
    if random.random() < 0.05:
        sentry_sdk.capture_exception(err)


def process_message(message: Message[KafkaPayload]) -> KafkaPayload | FilteredPayload:
    try:
        return _process_message(message)
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
        input_block_size: Optional[int],
        output_block_size: Optional[int],
    ):
        super().__init__()

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
        self.__pool = MultiprocessingPool(num_processes)

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
            max_batch_size=self.__max_batch_size,
            max_batch_time=self.__max_batch_time,
            pool=self.__pool,
            input_block_size=self.__input_block_size,
            output_block_size=self.__output_block_size,
            function=process_message,
            next_step=next_step,
        )

    def shutdown(self) -> None:
        self.__producer.close()
        self.__pool.close()
