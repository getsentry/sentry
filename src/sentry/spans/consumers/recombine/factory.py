import logging
from collections.abc import Mapping
from typing import Any

from arroyo.backends.kafka.consumer import KafkaPayload
from arroyo.processing.strategies.abstract import ProcessingStrategy, ProcessingStrategyFactory
from arroyo.processing.strategies.commit import CommitOffsets
from arroyo.processing.strategies.run_task import RunTask
from arroyo.types import BrokerValue, Commit, Message, Partition
from sentry_kafka_schemas import get_codec
from sentry_kafka_schemas.codecs import Codec, ValidationError
from sentry_kafka_schemas.schema_types.buffered_segments_v1 import BufferedSegment

from sentry.spans.consumers.recombine.message import process_segment

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


class RecombineSegmentStrategyFactory(ProcessingStrategyFactory[KafkaPayload]):
    def create_with_partitions(
        self,
        commit: Commit,
        partitions: Mapping[Partition, int],
    ) -> ProcessingStrategy[KafkaPayload]:
        return RunTask(
            function=_process_message,
            next_step=CommitOffsets(commit),
        )
