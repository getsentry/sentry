import logging
from collections.abc import Mapping

import orjson
from arroyo import Topic as ArroyoTopic
from arroyo.backends.kafka import KafkaProducer, build_kafka_configuration
from arroyo.backends.kafka.consumer import KafkaPayload
from arroyo.processing.strategies.abstract import ProcessingStrategy, ProcessingStrategyFactory
from arroyo.processing.strategies.commit import CommitOffsets
from arroyo.processing.strategies.produce import Produce
from arroyo.processing.strategies.run_task import RunTask
from arroyo.processing.strategies.unfold import Unfold
from arroyo.types import Commit, Message, Partition, Value
from sentry_kafka_schemas.codecs import Codec
from sentry_kafka_schemas.schema_types.buffered_segments_v1 import BufferedSegment, SegmentSpan

from sentry import options
from sentry.conf.types.kafka_definition import Topic, get_topic_codec
from sentry.spans.consumers.process_segments.message import process_segment
from sentry.utils.arroyo import MultiprocessingPool, run_task_with_multiprocessing
from sentry.utils.kafka_config import get_kafka_producer_cluster_options, get_topic_definition

BUFFERED_SEGMENT_SCHEMA: Codec[BufferedSegment] = get_topic_codec(Topic.BUFFERED_SEGMENTS)

logger = logging.getLogger(__name__)


def _deserialize_segment(value: bytes) -> BufferedSegment:
    return BUFFERED_SEGMENT_SCHEMA.decode(value)


def process_message(message: Message[KafkaPayload]) -> list[SegmentSpan]:
    value = message.payload.value
    segment = _deserialize_segment(value)
    return process_segment(segment["spans"])


def _process_message(message: Message[KafkaPayload]) -> list[SegmentSpan]:
    if not options.get("standalone-spans.process-segments-consumer.enable"):
        return []

    try:
        return process_message(message)
    except Exception:  # NOQA
        raise
        # TODO: Implement error handling
        # sentry_sdk.capture_exception()
        # assert isinstance(message.value, BrokerValue)
        # raise InvalidMessage(message.value.partition, message.value.offset)


def explode_segment(message: tuple[list[SegmentSpan], Mapping[Partition, int]]):
    spans, committable = message
    last = len(spans) - 1
    for i, span in enumerate(spans):
        if span is not None:
            yield Value(
                payload=KafkaPayload(key=None, value=orjson.dumps(span), headers=[]),
                committable=committable if i == last else {},
                timestamp=None,
            )


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

        topic_definition = get_topic_definition(Topic.SNUBA_SPANS)
        producer_config = get_kafka_producer_cluster_options(topic_definition["cluster"])
        self.producer = KafkaProducer(build_kafka_configuration(default_config=producer_config))
        self.output_topic = ArroyoTopic(topic_definition["real_topic_name"])

    def create_with_partitions(
        self,
        commit: Commit,
        partitions: Mapping[Partition, int],
    ) -> ProcessingStrategy[KafkaPayload]:
        produce_step = Produce(
            producer=self.producer,
            topic=self.output_topic,
            next_step=CommitOffsets(commit),
        )

        # XXX: Remove after https://github.com/getsentry/arroyo/pull/427: Unfold
        # does not pass through the commit and there is no way to access it from
        # the generator function.
        zip_commit = RunTask(
            function=lambda m: (m.payload, m.committable),
            next_step=Unfold(generator=explode_segment, next_step=produce_step),
        )

        return run_task_with_multiprocessing(
            function=_process_message,
            next_step=zip_commit,
            max_batch_size=self.max_batch_size,
            max_batch_time=self.max_batch_time,
            pool=self.pool,
            input_block_size=self.input_block_size,
            output_block_size=self.output_block_size,
        )

    def shutdown(self):
        self.pool.close()
