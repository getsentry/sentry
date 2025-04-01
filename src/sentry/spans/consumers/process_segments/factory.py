import logging
from collections.abc import Mapping

import orjson
from arroyo import Topic as ArroyoTopic
from arroyo.backends.kafka import KafkaProducer, build_kafka_configuration
from arroyo.backends.kafka.consumer import KafkaPayload
from arroyo.processing.strategies.abstract import ProcessingStrategy, ProcessingStrategyFactory
from arroyo.processing.strategies.commit import CommitOffsets
from arroyo.processing.strategies.produce import Produce
from arroyo.processing.strategies.unfold import Unfold
from arroyo.types import Commit, FilteredPayload, Message, Partition, Value

from sentry import options
from sentry.conf.types.kafka_definition import Topic
from sentry.spans.consumers.process_segments.message import process_segment
from sentry.utils.arroyo import MultiprocessingPool, run_task_with_multiprocessing
from sentry.utils.kafka_config import get_kafka_producer_cluster_options, get_topic_definition

logger = logging.getLogger(__name__)

# An amortized ceiling of spans per segment used to compute the size of the
# produce buffer. If that buffer fills up, the consumer exercises backpressure.
# We use the 95th percentile, since the average is much lower and equalizes over
# the batches.
#
# NOTE: The true maximum is 1000 at the time of writing.
SPANS_PER_SEG_P95 = 350


class DetectPerformanceIssuesStrategyFactory(ProcessingStrategyFactory[KafkaPayload]):
    def __init__(
        self,
        max_batch_size: int,
        max_batch_time: int,
        num_processes: int,
        input_block_size: int | None,
        output_block_size: int | None,
        skip_produce: bool,
    ):
        super().__init__()
        self.max_batch_size = max_batch_size
        self.max_batch_time = max_batch_time
        self.input_block_size = input_block_size
        self.output_block_size = output_block_size
        self.skip_produce = skip_produce
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
        commit_step = CommitOffsets(commit)

        produce_step: ProcessingStrategy[FilteredPayload | KafkaPayload]

        if not self.skip_produce:
            # Due to the unfold step that precedes the producer, this pipeline
            # writes large bursts of spans at once when a batch of segments is
            # finished by the multi processing pool. We size the produce buffer
            # so that it can accommodate batches from all subprocesses at the
            # sime time, assuming some upper bound of spans per segment.
            max_buffer_size = self.max_batch_size * self.pool.pool.num_processes * SPANS_PER_SEG_P95

            produce_step = Produce(
                producer=self.producer,
                topic=self.output_topic,
                next_step=commit_step,
                max_buffer_size=max_buffer_size,
            )
        else:
            produce_step = commit_step

        unfold_step = Unfold(generator=_unfold_segment, next_step=produce_step)

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


def _process_message(message: Message[KafkaPayload]) -> list[bytes]:
    if not options.get("standalone-spans.process-segments-consumer.enable"):
        return []

    try:
        value = message.payload.value
        segment = orjson.loads(value)
        processed = process_segment(segment["spans"])
        return [orjson.dumps(span) for span in processed]
    except Exception:  # NOQA
        raise
        # TODO: Implement error handling
        # sentry_sdk.capture_exception()
        # assert isinstance(message.value, BrokerValue)
        # raise InvalidMessage(message.value.partition, message.value.offset)


def _unfold_segment(spans: list[bytes]):
    return [
        Value(KafkaPayload(key=None, value=span, headers=[]), {})
        for span in spans
        if span is not None
    ]
