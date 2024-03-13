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

from sentry import options
from sentry.spans.buffer.redis import RedisSpansBuffer
from sentry.tasks.spans import process_segment

logger = logging.getLogger(__name__)
SPAN_SCHEMA: Codec[SpanEvent] = get_codec("snuba-spans")

PROCESS_SEGMENT_DELAY = 2 * 60  # 2 minutes


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

    client = RedisSpansBuffer()
    new_segment = client.write_span(project_id, segment_id, message.payload.value)
    if new_segment:
        # This function currently does nothing.
        process_segment.apply_async(
            args=[project_id, segment_id],
            countdown=PROCESS_SEGMENT_DELAY,
        )


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
