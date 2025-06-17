import logging
import multiprocessing
import multiprocessing.context
import threading
import time
from collections.abc import Callable
from functools import partial

import orjson
import sentry_sdk
from arroyo import Topic as ArroyoTopic
from arroyo.backends.kafka import KafkaPayload, KafkaProducer, build_kafka_configuration
from arroyo.processing.strategies.abstract import MessageRejected, ProcessingStrategy
from arroyo.types import FilteredPayload, Message

from sentry import options
from sentry.conf.types.kafka_definition import Topic
from sentry.spans.buffer import SpansBuffer
from sentry.utils import metrics
from sentry.utils.arroyo import run_with_initialized_sentry
from sentry.utils.kafka_config import get_kafka_producer_cluster_options, get_topic_definition

MAX_PROCESS_RESTARTS = 10

logger = logging.getLogger(__name__)


class SpanFlusher(ProcessingStrategy[FilteredPayload | int]):
    """
    A background thread that polls Redis for new segments to flush and to produce to Kafka.

    This is a processing step to be embedded into the consumer that writes to
    Redis. It takes and fowards integer messages that represent recently
    processed timestamps (from the producer timestamp of the incoming span
    message), which are then used as a clock to determine whether segments have expired.

    :param topic: The topic to send segments to.
    :param produce_to_pipe: For unit-testing, produce to this multiprocessing Pipe instead of creating a kafka consumer.
    """

    def __init__(
        self,
        buffer: SpansBuffer,
        next_step: ProcessingStrategy[FilteredPayload | int],
        produce_to_pipe: Callable[[KafkaPayload], None] | None = None,
    ):
        self.buffer = buffer
        self.next_step = next_step

        self.mp_context = mp_context = multiprocessing.get_context("spawn")
        self.stopped = mp_context.Value("i", 0)
        self.redis_was_full = False
        self.current_drift = mp_context.Value("i", 0)
        self.backpressure_since = mp_context.Value("i", 0)
        self.healthy_since = mp_context.Value("i", 0)
        self.process_restarts = 0
        self.produce_to_pipe = produce_to_pipe

        self._create_process()

    def _create_process(self):
        # Optimistically reset healthy_since to avoid a race between the
        # starting process and the next flush cycle. Keep back pressure across
        # the restart, however.
        self.healthy_since.value = int(time.time())

        make_process: Callable[..., multiprocessing.context.SpawnProcess | threading.Thread]
        if self.produce_to_pipe is None:
            target = run_with_initialized_sentry(
                SpanFlusher.main,
                # unpickling buffer will import sentry, so it needs to be
                # pickled separately. at the same time, pickling
                # synchronization primitives like multiprocessing.Value can
                # only be done by the Process
                self.buffer,
            )
            make_process = self.mp_context.Process
        else:
            target = partial(SpanFlusher.main, self.buffer)
            make_process = threading.Thread

        self.process = make_process(
            target=target,
            args=(
                self.stopped,
                self.current_drift,
                self.backpressure_since,
                self.healthy_since,
                self.produce_to_pipe,
            ),
            daemon=True,
        )

        self.process.start()

    @staticmethod
    def main(
        buffer: SpansBuffer,
        stopped,
        current_drift,
        backpressure_since,
        healthy_since,
        produce_to_pipe: Callable[[KafkaPayload], None] | None,
    ) -> None:
        sentry_sdk.set_tag("sentry_spans_buffer_component", "flusher")

        try:
            producer_futures = []

            if produce_to_pipe is not None:
                produce = produce_to_pipe
                producer = None
            else:
                cluster_name = get_topic_definition(Topic.BUFFERED_SEGMENTS)["cluster"]

                producer_config = get_kafka_producer_cluster_options(cluster_name)
                producer = KafkaProducer(build_kafka_configuration(default_config=producer_config))
                topic = ArroyoTopic(
                    get_topic_definition(Topic.BUFFERED_SEGMENTS)["real_topic_name"]
                )

                def produce(payload: KafkaPayload) -> None:
                    producer_futures.append(producer.produce(topic, payload))

            while not stopped.value:
                system_now = int(time.time())
                now = system_now + current_drift.value
                flushed_segments = buffer.flush_segments(now=now)

                # Check backpressure flag set by buffer
                if buffer.any_shard_at_limit:
                    if backpressure_since.value == 0:
                        backpressure_since.value = system_now
                else:
                    backpressure_since.value = 0

                healthy_since.value = system_now

                if not flushed_segments:
                    time.sleep(1)
                    continue

                with metrics.timer("spans.buffer.flusher.produce"):
                    for _, flushed_segment in flushed_segments.items():
                        if not flushed_segment.spans:
                            continue

                        spans = [span.payload for span in flushed_segment.spans]
                        kafka_payload = KafkaPayload(None, orjson.dumps({"spans": spans}), [])
                        metrics.timing("spans.buffer.segment_size_bytes", len(kafka_payload.value))
                        produce(kafka_payload)

                with metrics.timer("spans.buffer.flusher.wait_produce"):
                    for future in producer_futures:
                        future.result()

                producer_futures.clear()

                buffer.done_flush_segments(flushed_segments)

            if producer is not None:
                producer.close()
        except KeyboardInterrupt:
            pass
        except Exception:
            sentry_sdk.capture_exception()
            raise

    def poll(self) -> None:
        self.next_step.poll()

    def _ensure_process_alive(self) -> None:
        max_unhealthy_seconds = options.get("spans.buffer.flusher.max-unhealthy-seconds")
        if not self.process.is_alive():
            exitcode = getattr(self.process, "exitcode", "unknown")
            cause = f"no_process_{exitcode}"
        elif int(time.time()) - self.healthy_since.value > max_unhealthy_seconds:
            cause = "hang"
        else:
            return  # healthy

        metrics.incr("spans.buffer.flusher_unhealthy", tags={"cause": cause})
        if self.process_restarts > MAX_PROCESS_RESTARTS:
            raise RuntimeError(f"flusher process crashed repeatedly ({cause}), restarting consumer")

        try:
            self.process.kill()
        except ValueError:
            pass  # Process already closed, ignore

        self.process_restarts += 1
        self._create_process()

    def submit(self, message: Message[FilteredPayload | int]) -> None:
        # Note that submit is not actually a hot path. Their message payloads
        # are mapped from *batches* of spans, and there are a handful of spans
        # per second at most. If anything, self.poll() might even be called
        # more often than submit()

        self._ensure_process_alive()

        self.buffer.record_stored_segments()

        # We pause insertion into Redis if the flusher is not making progress
        # fast enough. We could backlog into Redis, but we assume, despite best
        # efforts, it is still always going to be less durable than Kafka.
        # Minimizing our Redis memory usage also makes COGS easier to reason
        # about.
        if self.backpressure_since.value > 0:
            backpressure_secs = options.get("spans.buffer.flusher.backpressure-seconds")
            if int(time.time()) - self.backpressure_since.value > backpressure_secs:
                metrics.incr("spans.buffer.flusher.backpressure")
                raise MessageRejected()

        # We set the drift. The backpressure based on redis memory comes after.
        # If Redis is full for a long time, the drift will grow into a large
        # negative value, effectively pausing flushing as well.
        if isinstance(message.payload, int):
            self.current_drift.value = drift = message.payload - int(time.time())
            metrics.timing("spans.buffer.flusher.drift", drift)

        # We also pause insertion into Redis if Redis is too full. In this case
        # we cannot allow the flusher to progress either, as it would write
        # partial/fragmented segments to buffered-segments topic. We have to
        # wait until the situation is improved manually.
        max_memory_percentage = options.get("spans.buffer.max-memory-percentage")
        if max_memory_percentage < 1.0:
            memory_infos = list(self.buffer.get_memory_info())
            used = sum(x.used for x in memory_infos)
            available = sum(x.available for x in memory_infos)
            if available > 0 and used / available > max_memory_percentage:
                if not self.redis_was_full:
                    logger.fatal("Pausing consumer due to Redis being full")
                metrics.incr("spans.buffer.flusher.hard_backpressure")
                self.redis_was_full = True
                # Pause consumer if Redis memory is full. Because the drift is
                # set before we emit backpressure, the flusher effectively
                # stops as well. Alternatively we may simply crash the consumer
                # but this would also trigger a lot of rebalancing.
                raise MessageRejected()

        self.redis_was_full = False
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

        if isinstance(self.process, multiprocessing.Process):
            self.process.terminate()
