import logging
from collections.abc import Mapping
from typing import Any

from arroyo.backends.kafka.consumer import KafkaPayload
from arroyo.processing.strategies.abstract import ProcessingStrategy, ProcessingStrategyFactory
from arroyo.processing.strategies.commit import CommitOffsets
from arroyo.types import BrokerValue, Commit, Message, Partition
from sentry_kafka_schemas import get_codec
from sentry_kafka_schemas.codecs import Codec, ValidationError
from sentry_kafka_schemas.schema_types.buffered_segments_v1 import BufferedSegment

from sentry.spans.consumers.detect_performance_issues.message import process_segment
from sentry.utils.arroyo import MultiprocessingPool, RunTaskWithMultiprocessing

BUFFERED_SEGMENT_SCHEMA: Codec[BufferedSegment] = get_codec("buffered-segments")

logger = logging.getLogger(__name__)


def _deserialize_segment(value: bytes) -> Mapping[str, Any]:
    return BUFFERED_SEGMENT_SCHEMA.decode(value)


def process_message(message: Message[KafkaPayload]):
    try:
        segment = _deserialize_segment(message.payload.value)
    except ValidationError:
        logger.exception("Failed to deserialize segment payload")
        return

    process_segment(segment["spans"])


def _process_message(message: Message[KafkaPayload]):
    assert isinstance(message.value, BrokerValue)

    try:
        process_message(message)
    except Exception:
        logger.exception("Failed to process segment payload")


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
