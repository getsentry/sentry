import logging
from collections.abc import Mapping
from typing import Any

from arroyo.backends.kafka.consumer import KafkaPayload
from arroyo.processing.strategies.abstract import ProcessingStrategy, ProcessingStrategyFactory
from arroyo.processing.strategies.commit import CommitOffsets
from arroyo.processing.strategies.run_task import RunTask
from arroyo.types import BrokerValue, Commit, Message, Partition
from sentry_kafka_schemas import get_codec
from sentry_kafka_schemas.codecs import Codec
from sentry_kafka_schemas.schema_types.snuba_spans_v1 import SpanEvent

from sentry.spans.buffer.redis import RedisSpansBuffer
from sentry.spans.producer import produce_segment_to_kafka

logger = logging.getLogger(__name__)
SPAN_SCHEMA: Codec[SpanEvent] = get_codec("snuba-spans")

PROCESS_SEGMENT_DELAY = 2 * 60  # 2 minutes
BATCH_SIZE = 100


def _deserialize_span(value: bytes) -> Mapping[str, Any]:
    return SPAN_SCHEMA.decode(value)


def process_message(message: Message[KafkaPayload]):
    assert isinstance(message.value, BrokerValue)
    try:
        span = _deserialize_span(message.payload.value)
        segment_id = span["segment_id"]
        project_id = span["project_id"]
    except Exception:
        logger.exception("Failed to process span payload")
        return

    timestamp = int(message.value.timestamp.timestamp())
    partition = message.value.partition.index

    client = RedisSpansBuffer()

    last_processed_timestamp = client.write_span_and_get_last_processed_timestamp(
        project_id, segment_id, timestamp, partition, message.payload.value
    )

    if last_processed_timestamp is None or timestamp > last_processed_timestamp:
        client.set_last_processed_timestamp(timestamp, partition)

    should_process_segments = False
    if last_processed_timestamp and timestamp > last_processed_timestamp:
        should_process_segments = True

    if should_process_segments:
        keys = client.get_unprocessed_segments_and_prune_bucket(timestamp, partition)
        # With pipelining, redis server is forced to queue replies using
        # up memory, so batching the keys we fetch.
        for i in range(0, len(keys), BATCH_SIZE):
            segments = client.read_many_segments(keys[i : i + BATCH_SIZE])
            client.expire_many_segments(keys)

            for _, segment in segments:
                produce_segment_to_kafka(segment)


class ProcessSpansStrategyFactory(ProcessingStrategyFactory[KafkaPayload]):
    def create_with_partitions(
        self,
        commit: Commit,
        partitions: Mapping[Partition, int],
    ) -> ProcessingStrategy[KafkaPayload]:
        return RunTask(
            function=process_message,
            next_step=CommitOffsets(commit),
        )
