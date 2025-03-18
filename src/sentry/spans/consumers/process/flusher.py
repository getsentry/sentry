import threading
import time
from concurrent import futures

import rapidjson
from arroyo import Topic as ArroyoTopic
from arroyo.backends.kafka import KafkaPayload, KafkaProducer
from arroyo.processing.strategies.abstract import ProcessingStrategy
from arroyo.types import FilteredPayload, Message

from sentry.spans.buffer import SpansBuffer
from sentry.utils import metrics


class SpanFlusher(ProcessingStrategy[FilteredPayload | int]):
    """
    A background thread that polls Redis for new segments to flush and to produce to Kafka.

    This is a processing step to be embedded into the consumer that writes to
    Redis. It takes and fowards integer messages that represent recently
    processed timestamps (from the producer timestamp of the incoming span
    message), which are then used as a clock to determine whether segments have expired.



    :param producer:
    :param topic: The topic to send segments to.
    :param max_flush_segments: How many segments to flush at once in a single Redis call.
    """

    def __init__(
        self,
        buffer: SpansBuffer,
        producer: KafkaProducer,
        topic: ArroyoTopic,
        max_flush_segments: int,
        next_step: ProcessingStrategy[FilteredPayload | int],
    ):
        self.buffer = buffer
        self.producer = producer
        self.topic = topic
        self.max_flush_segments = max_flush_segments
        self.next_step = next_step

        self.stopped = False
        self.current_drift = 0

        self.thread = threading.Thread(target=self.main, daemon=True)
        self.thread.start()

    def main(self):
        while not self.stopped:
            now = int(time.time()) + self.current_drift

            producer_futures = []

            queue_size, flushed_segments = self.buffer.flush_segments(
                max_segments=self.max_flush_segments, now=now
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

                producer_futures.append(self.producer.produce(self.topic, kafka_payload))

            futures.wait(producer_futures)

            self.buffer.done_flush_segments(flushed_segments)

    def poll(self) -> None:
        self.next_step.poll()

    def submit(self, message: Message[FilteredPayload | int]) -> None:
        if isinstance(message.payload, int):
            self.current_drift = message.payload - int(time.time())
        self.next_step.submit(message)

    def terminate(self) -> None:
        self.stopped = True
        self.next_step.terminate()

    def close(self) -> None:
        self.stopped = True
        self.next_step.close()

    def join(self, timeout: float | None = None):
        # set stopped flag first so we can "flush" the background thread while
        # next_step is also shutting down. we can do two things at once!
        self.stopped = True
        deadline = time.time() + timeout if timeout else None

        self.next_step.join(timeout)

        while self.thread.is_alive() and (deadline is None or deadline > time.time()):
            time.sleep(0.1)
