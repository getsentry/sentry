import logging
from collections.abc import Mapping
from typing import Any

from arroyo.backends.kafka.consumer import KafkaPayload
from arroyo.processing.strategies.abstract import ProcessingStrategy, ProcessingStrategyFactory
from arroyo.processing.strategies.commit import CommitOffsets
from arroyo.types import BrokerValue, Commit, Message, Partition
from sentry_kafka_schemas import get_codec
from sentry_kafka_schemas.codecs import Codec
from sentry_kafka_schemas.schema_types.snuba_spans_v1 import SpanEvent

from sentry import options
from sentry.spans.buffer.redis import RedisSpansBuffer
from sentry.spans.produce_segment import produce_segment_to_kafka
from sentry.utils.arroyo import MultiprocessingPool, RunTaskWithMultiprocessing

logger = logging.getLogger(__name__)
SPAN_SCHEMA: Codec[SpanEvent] = get_codec("snuba-spans")

PROCESS_SEGMENT_DELAY = 2 * 60  # 2 minutes
BATCH_SIZE = 100


def _deserialize_span(value: bytes) -> Mapping[str, Any]:
    return SPAN_SCHEMA.decode(value)


def process_message(message: Message[KafkaPayload]):
    if not options.get("standalone-spans.process-spans-consumer.enable"):
        return

    assert isinstance(message.value, BrokerValue)
    try:
        span = _deserialize_span(message.payload.value)
        segment_id = span["segment_id"]
        project_id = span["project_id"]
    except Exception:
        logger.exception("Failed to process span payload")
        return

    if project_id not in options.get("standalone-spans.process-spans-consumer.project-allowlist"):
        return

    timestamp = int(message.value.timestamp.timestamp())
    partition = message.value.partition.index

    client = RedisSpansBuffer()

    should_process_segments = client.write_span_and_check_processing(
        project_id, segment_id, timestamp, partition, message.payload.value
    )

    if should_process_segments:
        keys = client.get_unprocessed_segments_and_prune_bucket(timestamp, partition)
        # With pipelining, redis server is forced to queue replies using
        # up memory, so batching the keys we fetch.
        for i in range(0, len(keys), BATCH_SIZE):
            segments = client.read_and_expire_many_segments(keys[i : i + BATCH_SIZE])

            for segment in segments:
                produce_segment_to_kafka(segment)


class ProcessSpansStrategyFactory(ProcessingStrategyFactory[KafkaPayload]):
    def __init__(
        self,
        max_batch_size: int,
        max_batch_time: int,
        num_processes: int,
        input_block_size: int | None,
        output_block_size: int | None,
    ):
        super().__init__()
        self.max_batch_size = max_batch_size
        self.max_batch_time = max_batch_time
        self.input_block_size = input_block_size
        self.output_block_size = output_block_size
        self.pool = MultiprocessingPool(num_processes)

    def create_with_partitions(
        self,
        commit: Commit,
        partitions: Mapping[Partition, int],
    ) -> ProcessingStrategy[KafkaPayload]:
        return RunTaskWithMultiprocessing(
            function=process_message,
            next_step=CommitOffsets(commit),
            max_batch_size=self.max_batch_size,
            max_batch_time=self.max_batch_time,
            pool=self.pool,
            input_block_size=self.input_block_size,
            output_block_size=self.output_block_size,
        )
