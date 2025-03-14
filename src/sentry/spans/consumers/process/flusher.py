import threading
import time
from concurrent import futures

import rapidjson
from arroyo import Topic as ArroyoTopic
from arroyo.backends.kafka import KafkaPayload, KafkaProducer
from arroyo.processing.strategies.abstract import MessageRejected, ProcessingStrategy
from arroyo.types import Message

from sentry.spans.buffer_v2 import RedisSpansBufferV2, segment_to_span_id
from sentry.utils import metrics


class SpanFlusher(ProcessingStrategy[int]):
    """
    A background thread that polls Redis for new segments to flush and to produce to Kafka.

    This is a processing step to be embedded into the consumer that writes to
    Redis. It takes and fowards integer messages that represent recently
    processed timestamps (from the producer timestamp of the incoming span
    message), which are then used as a clock to determine whether segments have expired.



    :param producer:
    :param topic: The topic to send segments to.
    :param max_flush_segments: How many segments to flush at once in a single Redis call.
    :param max_inflight_segments: How many segments should exist in Redis until
        backpressure is applied. Since this is run as a processing strategy within
        the main consumer, the flusher can apply the backpressure itself.
    """

    def __init__(
        self,
        buffer: RedisSpansBufferV2,
        producer: KafkaProducer,
        topic: ArroyoTopic,
        max_flush_segments: int,
        max_inflight_segments: int,
        next_step: ProcessingStrategy[int],
    ):
        self.buffer = buffer
        self.producer = producer
        self.topic = topic
        self.max_flush_segments = max_flush_segments
        self.max_inflight_segments = max_inflight_segments
        self.next_step = next_step

        self.stopped = False
        self.enable_backpressure = False
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
            self.enable_backpressure = (
                self.max_inflight_segments > 0 and queue_size >= self.max_inflight_segments
            )

            if not flushed_segments:
                time.sleep(1)
                continue

            for segment_id, spans_set in flushed_segments.items():
                segment_span_id = segment_to_span_id(segment_id)
                if not spans_set:
                    # This is a bug, most likely the input topic is not
                    # partitioned by trace_id so multiple consumers are writing
                    # over each other. The consequence is duplicated segments,
                    # worst-case.
                    metrics.incr("sentry.spans.buffer.empty_segments")
                    continue

                segment_spans = []
                for payload in spans_set:
                    val = rapidjson.loads(payload)
                    val["segment_id"] = segment_span_id
                    val["is_segment"] = segment_span_id == val["span_id"]
                    segment_spans.append(val)

                kafka_payload = KafkaPayload(
                    None, rapidjson.dumps({"spans": segment_spans}).encode("utf8"), []
                )

                producer_futures.append(self.producer.produce(self.topic, kafka_payload))

            futures.wait(producer_futures)

            self.buffer.done_flush_segments(flushed_segments)

    def poll(self) -> None:
        self.next_step.poll()

    def submit(self, message: Message[int]) -> None:
        self.current_drift = message.payload - int(time.time())

        if self.enable_backpressure:
            raise MessageRejected()

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
