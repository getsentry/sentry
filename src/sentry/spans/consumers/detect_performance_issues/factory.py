import logging
from collections.abc import Mapping
from typing import Any

import sentry_sdk
from arroyo.backends.kafka.consumer import KafkaPayload
from arroyo.processing.strategies.abstract import ProcessingStrategy, ProcessingStrategyFactory
from arroyo.processing.strategies.commit import CommitOffsets
from arroyo.types import BrokerValue, Commit, Message, Partition
from sentry_kafka_schemas import get_codec
from sentry_kafka_schemas.codecs import Codec
from sentry_kafka_schemas.schema_types.buffered_segments_v1 import BufferedSegment

from sentry import options
from sentry.spans.consumers.detect_performance_issues.message import process_segment
from sentry.utils.arroyo import MultiprocessingPool, RunTaskWithMultiprocessing

BUFFERED_SEGMENT_SCHEMA: Codec[BufferedSegment] = get_codec("buffered-segments")

logger = logging.getLogger(__name__)


def _deserialize_segment(value: bytes) -> Mapping[str, Any]:
    return BUFFERED_SEGMENT_SCHEMA.decode(value)


def process_message(message: Message[KafkaPayload]):
    value = message.payload.value
    segment = _deserialize_segment(value)

    assert segment["spans"]

    process_segment(segment["spans"])


def _process_message(message: Message[KafkaPayload]):
    if not options.get("standalone-spans.detect-performance-issues-consumer.enable"):
        return

    assert isinstance(message.value, BrokerValue)

    try:
        with sentry_sdk.start_transaction(
            op="process", name="spans.detect_performance_issues.process_message"
        ):
            sentry_sdk.set_measurement("message_size.bytes", len(message.payload.value))
            process_message(message)
    except Exception:
        sentry_sdk.capture_exception()


class DetectPerformanceIssuesStrategyFactory(ProcessingStrategyFactory[KafkaPayload]):
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
            function=_process_message,
            next_step=CommitOffsets(commit),
            max_batch_size=self.max_batch_size,
            max_batch_time=self.max_batch_time,
            pool=self.pool,
            input_block_size=self.input_block_size,
            output_block_size=self.output_block_size,
        )

    def shutdown(self):
        self.pool.close()
