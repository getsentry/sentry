import multiprocessing
import multiprocessing.connection
import time
from collections.abc import Callable
from concurrent import futures
from typing import Any

import rapidjson
from arroyo import Topic as ArroyoTopic
from arroyo.backends.kafka import KafkaPayload, KafkaProducer, build_kafka_configuration
from arroyo.processing.strategies.abstract import ProcessingStrategy
from arroyo.types import FilteredPayload, Message

from sentry.conf.types.kafka_definition import Topic
from sentry.spans.buffer import SpansBuffer
from sentry.utils import metrics
from sentry.utils.kafka_config import get_kafka_producer_cluster_options, get_topic_definition


class SpanFlusher(ProcessingStrategy[FilteredPayload | int]):
    """
    A background thread that polls Redis for new segments to flush and to produce to Kafka.

    This is a processing step to be embedded into the consumer that writes to
    Redis. It takes and fowards integer messages that represent recently
    processed timestamps (from the producer timestamp of the incoming span
    message), which are then used as a clock to determine whether segments have expired.

    :param topic: The topic to send segments to.
    :param max_flush_segments: How many segments to flush at once in a single Redis call.
    :param produce_to_pipe: For unit-testing, produce to this multiprocessing Pipe instead of creating a kafka consumer.
    """

    def __init__(
        self,
        buffer: SpansBuffer,
        max_flush_segments: int,
        produce_to_pipe: multiprocessing.connection.Connection | None,
        next_step: ProcessingStrategy[FilteredPayload | int],
    ):
        self.buffer = buffer
        self.max_flush_segments = max_flush_segments
        self.next_step = next_step

        self.stopped = multiprocessing.Value("i", 0)
        self.current_drift = multiprocessing.Value("i", 0)

        from sentry.utils.arroyo import _get_arroyo_subprocess_initializer

        initializer = _get_arroyo_subprocess_initializer(None)

        self.process = multiprocessing.Process(
            target=SpanFlusher.main,
            args=(
                initializer,
                self.stopped,
                self.current_drift,
                self.buffer,
                self.max_flush_segments,
                produce_to_pipe,
            ),
            daemon=True,
        )
        self.process.start()

    @staticmethod
    def main(initializer, stopped, current_drift, buffer, max_flush_segments, produce_to_pipe):
        initializer()

        producer_futures = []

        wait: Callable[[list[futures.Future]], Any]

        if produce_to_pipe:
            produce = produce_to_pipe.send
            producer = None
            wait = lambda _: None
        else:
            cluster_name = get_topic_definition(Topic.BUFFERED_SEGMENTS)["cluster"]

            producer_config = get_kafka_producer_cluster_options(cluster_name)
            producer = KafkaProducer(build_kafka_configuration(default_config=producer_config))
            topic = ArroyoTopic(get_topic_definition(Topic.BUFFERED_SEGMENTS)["real_topic_name"])

            def produce(payload):
                producer_futures.append(producer.produce(topic, payload))

            wait = futures.wait

        while not stopped.value:
            now = int(time.time()) + current_drift.value

            queue_size, flushed_segments = buffer.flush_segments(
                max_segments=max_flush_segments, now=now
            )
            metrics.timing("sentry.spans.buffer.inflight_segments", queue_size)

            if not flushed_segments:
                time.sleep(1)
                continue

            for _, spans_set in flushed_segments.items():
                if not spans_set:
                    # This is a bug, most likely the input topic is not
                    # partitioned by trace_id so multiple consumers are writing
                    # over each other. The consequence is duplicated segments,
                    # worst-case.
                    metrics.incr("sentry.spans.buffer.empty_segments")
                    continue

                spans = [span.payload for span in spans_set]

                kafka_payload = KafkaPayload(
                    None, rapidjson.dumps({"spans": spans}).encode("utf8"), []
                )

                produce(kafka_payload)

            wait(producer_futures)
            producer_futures.clear()

            buffer.done_flush_segments(flushed_segments)

        if producer is not None:
            producer.close()

    def poll(self) -> None:
        self.next_step.poll()

    def submit(self, message: Message[FilteredPayload | int]) -> None:
        if isinstance(message.payload, int):
            self.current_drift = message.payload - int(time.time())
        self.next_step.submit(message)

    def terminate(self) -> None:
        self.stopped.value = True
        self.next_step.terminate()

    def close(self) -> None:
        self.stopped.value = True
        self.next_step.close()

    def join(self, timeout: float | None = None):
        # set stopped flag first so we can "flush" the background thread while
        # next_step is also shutting down. we can do two things at once!
        self.stopped.value = True
        deadline = time.time() + timeout if timeout else None

        self.next_step.join(timeout)

        while self.process.is_alive() and (deadline is None or deadline > time.time()):
            time.sleep(0.1)

        self.process.terminate()
