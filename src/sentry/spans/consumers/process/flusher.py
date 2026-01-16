import logging
import multiprocessing
import multiprocessing.context
import threading
import time
from collections.abc import Callable, Mapping
from functools import partial

import orjson
import sentry_sdk
from arroyo import Topic as ArroyoTopic
from arroyo.backends.abstract import Producer
from arroyo.backends.kafka import KafkaPayload, KafkaProducer, build_kafka_producer_configuration
from arroyo.processing.strategies.abstract import MessageRejected, ProcessingStrategy
from arroyo.types import FilteredPayload, Message
from django.conf import settings

from sentry import options
from sentry.conf.types.kafka_definition import Topic
from sentry.processing.backpressure.memory import ServiceMemory
from sentry.spans.buffer import SpansBuffer
from sentry.utils import metrics
from sentry.utils.arroyo import run_with_initialized_sentry
from sentry.utils.kafka_config import get_kafka_producer_cluster_options, get_topic_definition

MAX_PROCESS_RESTARTS = 10

logger = logging.getLogger(__name__)


class MultiProducer:
    """
    Manages multiple Kafka producers for load balancing across brokers/topics.

    Configure multiple producers using SLICED_KAFKA_TOPICS in settings.py:

    SLICED_KAFKA_TOPICS = {
        ("buffered-segments", 0): {"cluster": "default", "topic": "buffered-segments-1"},
        ("buffered-segments", 1): {"cluster": "secondary", "topic": "buffered-segments-2"}
    }
    """

    def __init__(
        self,
        topic: Topic,
        producer_factory: Callable[[Mapping[str, object]], Producer[KafkaPayload]] | None = None,
    ):
        self.topic = topic
        self.producers: list[Producer[KafkaPayload]] = []
        self.topics: list[ArroyoTopic] = []
        self.current_index = 0
        self.producer_factory = producer_factory or self._default_producer_factory
        self._setup_producers()

    def _default_producer_factory(self, producer_config: Mapping[str, object]) -> KafkaProducer:
        """Default factory that creates real KafkaProducers."""
        producer_config = dict(producer_config)
        producer_config["client.id"] = "sentry.spans.consumers.process.flusher"
        return KafkaProducer(build_kafka_producer_configuration(default_config=producer_config))

    def _setup_producers(self):
        """Setup producers based on SLICED_KAFKA_TOPICS configuration."""
        # Get sliced Kafka topics configuration
        sliced_configs = []
        for (topic_name, slice_id), config in settings.SLICED_KAFKA_TOPICS.items():
            if topic_name == self.topic.value:
                sliced_configs.append(config)

        if sliced_configs:
            # Multiple producers configured via SLICED_KAFKA_TOPICS
            # TODO(markus): Everything should go through get_arroyo_producer
            for config in sliced_configs:
                cluster_name = config["cluster"]
                topic_name = config["topic"]

                producer_config = get_kafka_producer_cluster_options(cluster_name)
                producer = self.producer_factory(producer_config)
                topic = ArroyoTopic(topic_name)

                self.producers.append(producer)
                self.topics.append(topic)
        else:
            # Single producer (backward compatibility)
            cluster_name = get_topic_definition(self.topic)["cluster"]
            producer_config = get_kafka_producer_cluster_options(cluster_name)
            producer = self.producer_factory(producer_config)
            topic = ArroyoTopic(get_topic_definition(self.topic)["real_topic_name"])

            self.producers.append(producer)
            self.topics.append(topic)

        # Validate that we have at least one producer
        if not self.producers:
            raise ValueError(f"No producers configured for topic {self.topic.value}")

    def produce(self, payload: KafkaPayload):
        """Produce message with load balancing."""
        if len(self.producers) == 1:
            # Single producer - no load balancing needed
            return self.producers[0].produce(self.topics[0], payload)

        # Round-robin load balancing
        producer_index = self.current_index % len(self.producers)
        self.current_index += 1

        return self.producers[producer_index].produce(self.topics[producer_index], payload)

    def close(self):
        """Close all producers."""
        for producer in self.producers:
            producer.close()


class SpanFlusher(ProcessingStrategy[FilteredPayload | int]):
    """
    A background multiprocessing manager that polls Redis for new segments to flush and to produce to Kafka.
    Creates one process per shard for parallel processing.

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
        max_processes: int | None = None,
        produce_to_pipe: Callable[[KafkaPayload], None] | None = None,
    ):
        self.next_step = next_step
        self.max_processes = max_processes or len(buffer.assigned_shards)
        self.slice_id = buffer.slice_id

        self.mp_context = mp_context = multiprocessing.get_context("spawn")
        self.stopped = mp_context.Value("i", 0)
        self.redis_was_full = False
        self.current_drift = mp_context.Value("i", 0)
        self.produce_to_pipe = produce_to_pipe

        # Determine which shards get their own processes vs shared processes
        self.num_processes = min(self.max_processes, len(buffer.assigned_shards))
        self.process_to_shards_map: dict[int, list[int]] = {
            i: [] for i in range(self.num_processes)
        }
        for i, shard in enumerate(buffer.assigned_shards):
            process_index = i % self.num_processes
            self.process_to_shards_map[process_index].append(shard)

        self.processes: dict[int, multiprocessing.context.SpawnProcess | threading.Thread] = {}
        self.process_healthy_since = {
            process_index: mp_context.Value("i", 0) for process_index in range(self.num_processes)
        }
        self.process_backpressure_since = {
            process_index: mp_context.Value("i", 0) for process_index in range(self.num_processes)
        }
        self.process_restarts = {process_index: 0 for process_index in range(self.num_processes)}
        self.buffers: dict[int, SpansBuffer] = {}

        self._create_processes()

        # When starting the consumer, block the consumer's main thread until
        # all processes are healthy. This ensures we do not write into Redis if
        # the flusher deterministically crashes on start, because in
        # combination with the consumer crashlooping this will cause Redis to
        # be filled up.
        for process_index in self.process_to_shards_map.keys():
            self._wait_for_process_to_become_healthy(process_index)

    def _wait_for_process_to_become_healthy(self, process_index: int):
        start_time = time.time()
        max_unhealthy_seconds = options.get("spans.buffer.flusher.max-unhealthy-seconds") * 2

        while True:
            if self.process_healthy_since[process_index].value != 0:
                break

            if time.time() - start_time > max_unhealthy_seconds:
                shards = self.process_to_shards_map[process_index]
                raise RuntimeError(
                    f"process {process_index} (shards {shards}) didn't start up in {max_unhealthy_seconds} seconds"
                )

            time.sleep(0.1)

    def _create_processes(self):
        # Create processes based on shard mapping
        for process_index, shards in self.process_to_shards_map.items():
            self._create_process_for_shards(process_index, shards)

    def _create_process_for_shards(self, process_index: int, shards: list[int]):
        self.process_healthy_since[process_index].value = 0

        logger.info("Creating flusher process %s for shards %s", process_index, shards)

        # Create a buffer for these specific shards
        shard_buffer = SpansBuffer(shards, slice_id=self.slice_id)

        make_process: Callable[..., multiprocessing.context.SpawnProcess | threading.Thread]
        if self.produce_to_pipe is None:
            target = run_with_initialized_sentry(
                SpanFlusher.main,
                # unpickling buffer will import sentry, so it needs to be
                # pickled separately. at the same time, pickling
                # synchronization primitives like multiprocessing.Value can
                # only be done by the Process
                shard_buffer,
            )
            make_process = self.mp_context.Process
        else:
            target = partial(SpanFlusher.main, shard_buffer)
            make_process = threading.Thread

        process = make_process(
            target=target,
            args=(
                shards,
                self.stopped,
                self.current_drift,
                self.process_backpressure_since[process_index],
                self.process_healthy_since[process_index],
                self.produce_to_pipe,
            ),
            daemon=True,
        )

        process.start()
        pid = getattr(process, "pid", None)
        logger.info("Flusher process %s started (pid=%s) for shards %s", process_index, pid, shards)
        self.processes[process_index] = process
        self.buffers[process_index] = shard_buffer

    def _create_process_for_shard(self, shard: int):
        # Find which process this shard belongs to and restart that process
        for process_index, shards in self.process_to_shards_map.items():
            if shard in shards:
                self._create_process_for_shards(process_index, shards)
                break

    @staticmethod
    def main(
        buffer: SpansBuffer,
        shards: list[int],
        stopped,
        current_drift,
        backpressure_since,
        healthy_since,
        produce_to_pipe: Callable[[KafkaPayload], None] | None,
    ) -> None:
        logger.info("Flusher process main started for shards %s", shards)

        # TODO: remove once span buffer is live in all regions
        scope = sentry_sdk.get_isolation_scope()
        scope.level = "warning"

        shard_tag = ",".join(map(str, shards))
        sentry_sdk.set_tag("sentry_spans_buffer_component", "flusher")
        sentry_sdk.set_tag("sentry_spans_buffer_shards", shard_tag)

        logger.info("Flusher process started for shards %s", shard_tag)

        try:
            producer_futures = []

            if produce_to_pipe is not None:
                produce = produce_to_pipe
                producer_manager = None
            else:
                logger.info("Flusher creating Kafka producer for shards %s", shard_tag)
                producer_manager = MultiProducer(Topic.BUFFERED_SEGMENTS)
                logger.info("Flusher Kafka producer created for shards %s", shard_tag)

                def produce(payload: KafkaPayload) -> None:
                    producer_futures.append(producer_manager.produce(payload))

            first_iteration = True
            while not stopped.value:
                system_now = int(time.time())
                now = system_now + current_drift.value
                flushed_segments = buffer.flush_segments(now=now)

                if first_iteration:
                    logger.info("Flusher first flush_segments completed for shards %s", shard_tag)

                # Check backpressure flag set by buffer
                if buffer.any_shard_at_limit:
                    if backpressure_since.value == 0:
                        backpressure_since.value = system_now
                else:
                    backpressure_since.value = 0

                # Update healthy_since for all shards handled by this process
                healthy_since.value = system_now

                if first_iteration:
                    logger.info("Flusher process healthy for shards %s", shard_tag)
                    first_iteration = False

                if not flushed_segments:
                    time.sleep(1)
                    continue

                with metrics.timer("spans.buffer.flusher.produce", tags={"shard": shard_tag}):
                    for flushed_segment in flushed_segments.values():
                        if not flushed_segment.spans:
                            continue

                        spans = [span.payload for span in flushed_segment.spans]
                        kafka_payload = KafkaPayload(None, orjson.dumps({"spans": spans}), [])
                        metrics.timing(
                            "spans.buffer.segment_size_bytes",
                            len(kafka_payload.value),
                            tags={"shard": shard_tag},
                        )
                        produce(kafka_payload)

                with metrics.timer("spans.buffer.flusher.wait_produce", tags={"shards": shard_tag}):
                    for future in producer_futures:
                        future.result()

                producer_futures.clear()

                buffer.done_flush_segments(flushed_segments)

            if producer_manager is not None:
                producer_manager.close()
        except KeyboardInterrupt:
            pass
        except Exception:
            sentry_sdk.capture_exception()
            raise

    def poll(self) -> None:
        self.next_step.poll()

    def _ensure_processes_alive(self) -> None:
        max_unhealthy_seconds = options.get("spans.buffer.flusher.max-unhealthy-seconds")

        for process_index, process in self.processes.items():
            if not process:
                continue

            shards = self.process_to_shards_map[process_index]

            cause = None
            if not process.is_alive():
                exitcode = getattr(process, "exitcode", "unknown")
                cause = f"no_process_{exitcode}"
            elif (
                int(time.time()) - self.process_healthy_since[process_index].value
                > max_unhealthy_seconds
            ):
                # Check if any shard handled by this process is unhealthy
                cause = "hang"

            if cause is None:
                continue  # healthy

            # Report unhealthy for all shards handled by this process
            for shard in shards:
                metrics.incr(
                    "spans.buffer.flusher_unhealthy", tags={"cause": cause, "shard": shard}
                )

            if self.process_restarts[process_index] > MAX_PROCESS_RESTARTS:
                raise RuntimeError(
                    f"flusher process for shards {shards} crashed repeatedly ({cause}), restarting consumer"
                )
            self.process_restarts[process_index] += 1

            try:
                if isinstance(process, multiprocessing.Process):
                    process.kill()
            except (ValueError, AttributeError):
                pass  # Process already closed, ignore

            self._create_process_for_shards(process_index, shards)
            self._wait_for_process_to_become_healthy(process_index)

    def submit(self, message: Message[FilteredPayload | int]) -> None:
        # Note that submit is not actually a hot path. Their message payloads
        # are mapped from *batches* of spans, and there are a handful of spans
        # per second at most. If anything, self.poll() might even be called
        # more often than submit()

        self._ensure_processes_alive()

        for buffer in self.buffers.values():
            buffer.record_stored_segments()

        # We pause insertion into Redis if the flusher is not making progress
        # fast enough. We could backlog into Redis, but we assume, despite best
        # efforts, it is still always going to be less durable than Kafka.
        # Minimizing our Redis memory usage also makes COGS easier to reason
        # about.
        backpressure_secs = options.get("spans.buffer.flusher.backpressure-seconds")
        for backpressure_since in self.process_backpressure_since.values():
            if (
                backpressure_since.value > 0
                and int(time.time()) - backpressure_since.value > backpressure_secs
            ):
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
            memory_infos: list[ServiceMemory] = []
            for buffer in self.buffers.values():
                memory_infos.extend(buffer.get_memory_info())
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
        # Do not shut down the flusher here -- this is running at the beginning
        # of rebalancing, so everytime we are rebalancing we will cause a huge
        # memory spike in redis
        self.next_step.close()

    def join(self, timeout: float | None = None):
        # set stopped flag first so we can "flush" the background threads while
        # next_step is also shutting down. we can do two things at once!
        self.stopped.value = True
        deadline = time.time() + timeout if timeout else None

        self.next_step.join(timeout)

        # Wait for all processes to finish
        for process_index, process in self.processes.items():
            if deadline is not None:
                remaining_time = deadline - time.time()
                if remaining_time <= 0:
                    break

            while process.is_alive() and (deadline is None or deadline > time.time()):
                time.sleep(0.1)

            if isinstance(process, multiprocessing.Process):
                process.terminate()
