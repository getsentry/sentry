import logging
from collections.abc import Mapping
from typing import Any

import rapidjson
import sentry_sdk
from arroyo import Topic as ArroyoTopic
from arroyo.backends.kafka import KafkaProducer, build_kafka_configuration
from arroyo.backends.kafka.consumer import KafkaPayload
from arroyo.processing.strategies.abstract import ProcessingStrategy, ProcessingStrategyFactory
from arroyo.processing.strategies.commit import CommitOffsets
from arroyo.processing.strategies.produce import Produce
from arroyo.processing.strategies.unfold import Unfold
from arroyo.types import BrokerValue, Commit, Message, Partition, Value
from sentry_kafka_schemas.codecs import Codec
from sentry_kafka_schemas.schema_types.buffered_segments_v1 import BufferedSegment

from sentry import options
from sentry.conf.types.kafka_definition import Topic, get_topic_codec
from sentry.spans.consumers.process_segments.message import process_segment
from sentry.utils.arroyo import MultiprocessingPool, run_task_with_multiprocessing
from sentry.utils.kafka_config import get_kafka_producer_cluster_options, get_topic_definition

BUFFERED_SEGMENT_SCHEMA: Codec[BufferedSegment] = get_topic_codec(Topic.BUFFERED_SEGMENTS)

logger = logging.getLogger(__name__)


def _deserialize_segment(value: bytes) -> Mapping[str, Any]:
    return BUFFERED_SEGMENT_SCHEMA.decode(value)


def process_message(message: Message[KafkaPayload]):
    value = message.payload.value
    segment = _deserialize_segment(value)
    return process_segment(segment["spans"])


def _process_message(message: Message[KafkaPayload]):
    if not options.get("standalone-spans.process-segments-consumer.enable"):
        return

    assert isinstance(message.value, BrokerValue)

    try:
        with sentry_sdk.start_transaction(
            op="process", name="spans.process_segments.process_message"
        ):
            sentry_sdk.set_measurement("message_size.bytes", len(message.payload.value))
            return process_message(message)
    except Exception:
        sentry_sdk.capture_exception()


def explode_segment(spans: list[dict[str, Any]]):
    for span in spans:
        if span is not None:
            payload = rapidjson.dumps(span)
            yield Value(KafkaPayload(None, payload, []), {}, None)


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

        cluster_name = get_topic_definition(Topic.SNUBA_SPANS)["cluster"]
        producer_config = get_kafka_producer_cluster_options(cluster_name)
        self.producer = KafkaProducer(build_kafka_configuration(default_config=producer_config))
        self.output_topic = ArroyoTopic(
            get_topic_definition(Topic.BUFFERED_SEGMENTS)["real_topic_name"]
        )

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

        unfold_step = Unfold(generator=explode_segment, next_step=produce_step)

        return run_task_with_multiprocessing(
            function=_process_message,
            next_step=unfold_step,
            max_batch_size=self.max_batch_size,
            max_batch_time=self.max_batch_time,
            pool=self.pool,
            input_block_size=self.input_block_size,
            output_block_size=self.output_block_size,
        )

    def shutdown(self):
        self.pool.close()
