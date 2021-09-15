import logging
import random
import signal
import time
from concurrent.futures import Future, ThreadPoolExecutor, as_completed
from contextlib import contextmanager
from typing import Any, Generator, Mapping, MutableSequence, Optional, Tuple

from confluent_kafka import OFFSET_INVALID, TopicPartition
from django.conf import settings
from django.utils.functional import cached_property

from sentry import options
from sentry.eventstream.kafka.consumer import SynchronizedConsumer
from sentry.eventstream.kafka.protocol import (
    get_task_kwargs_for_message,
    get_task_kwargs_for_message_from_headers,
)
from sentry.eventstream.snuba import SnubaProtocolEventStream
from sentry.utils import json, kafka, metrics

logger = logging.getLogger(__name__)

Message = Any
__DURATION_METRIC__ = "eventstream.duration"


class KafkaEventStream(SnubaProtocolEventStream):
    def __init__(self, **options):
        self.topic = settings.KAFKA_TOPICS[settings.KAFKA_EVENTS]["topic"]
        self._pending_futures: MutableSequence[Future] = []
        self._batch_create_time_ms: int = int(time.time() * 1000)

    @cached_property
    def producer(self):
        return kafka.producers.get(settings.KAFKA_EVENTS)

    def delivery_callback(self, error, message):
        if error is not None:
            logger.warning("Could not publish message (error: %s): %r", error, message)

    def _get_headers_for_insert(
        self,
        group,
        event,
        is_new,
        is_regression,
        is_new_group_environment,
        primary_hash,
        received_timestamp: float,
        skip_consume,
    ) -> Mapping[str, str]:

        # HACK: We are putting all this extra information that is required by the
        # post process forwarder into the headers so we can skip parsing entire json
        # messages. The post process forwarder is currently bound to a single core.
        # Once we are able to parallelize the JSON parsing and other transformation
        # steps being done there we may want to remove this hack.
        def encode_bool(value: Optional[bool]) -> str:
            if value is None:
                value = False
            return str(int(value))

        # WARNING: We must remove all None headers. There is a bug in confluent-kafka-python
        # (used by both Sentry and Snuba) that incorrectly decrements the reference count of
        # Python's None on any attempt to read header values containing null values, leading
        # None to eventually get deallocated and crash the interpreter. The bug exists in the
        # version we are using (1.5) as well as in the latest (at the time of writing) 1.7 version.
        def strip_none_values(value: Mapping[str, Optional[str]]) -> Mapping[str, str]:
            return {key: value for key, value in value.items() if value is not None}

        send_new_headers = options.get("eventstream:kafka-headers")

        if send_new_headers is True:
            return strip_none_values(
                {
                    "Received-Timestamp": str(received_timestamp),
                    "event_id": str(event.event_id),
                    "project_id": str(event.project_id),
                    "group_id": str(event.group_id) if event.group_id is not None else None,
                    "primary_hash": str(primary_hash) if primary_hash is not None else None,
                    "is_new": encode_bool(is_new),
                    "is_new_group_environment": encode_bool(is_new_group_environment),
                    "is_regression": encode_bool(is_regression),
                    "skip_consume": encode_bool(skip_consume),
                }
            )
        else:
            return super()._get_headers_for_insert(
                group,
                event,
                is_new,
                is_regression,
                is_new_group_environment,
                primary_hash,
                received_timestamp,
                skip_consume,
            )

    def _send(
        self,
        project_id: int,
        _type: str,
        extra_data: Tuple[Any, ...] = (),
        asynchronous: bool = True,
        headers: Optional[Mapping[str, str]] = None,
    ):
        if headers is None:
            headers = {}
        headers["operation"] = _type
        headers["version"] = str(self.EVENT_PROTOCOL_VERSION)

        # Polling the producer is required to ensure callbacks are fired. This
        # means that the latency between a message being delivered (or failing
        # to be delivered) and the corresponding callback being fired is
        # roughly the same as the duration of time that passes between publish
        # calls. If this ends up being too high, the publisher should be moved
        # into a background thread that can poll more frequently without
        # interfering with request handling. (This does `poll` does not act as
        # a heartbeat for the purposes of any sort of session expiration.)
        # Note that this call to poll() is *only* dealing with earlier
        # asynchronous produce() calls from the same process.
        self.producer.poll(0.0)

        assert isinstance(extra_data, tuple)
        key = str(project_id)

        try:
            self.producer.produce(
                topic=self.topic,
                key=key.encode("utf-8"),
                value=json.dumps((self.EVENT_PROTOCOL_VERSION, _type) + extra_data),
                on_delivery=self.delivery_callback,
                headers=[(k, v.encode("utf-8")) for k, v in headers.items()],
            )
        except Exception as error:
            logger.error("Could not publish message: %s", error, exc_info=True)
            return

        if not asynchronous:
            # flush() is a convenience method that calls poll() until len() is zero
            self.producer.flush()

    def requires_post_process_forwarder(self):
        return True

    def reset_batch(self) -> None:
        self._pending_futures.clear()
        self._batch_create_time_ms = int(time.time() * 1000)

    @staticmethod
    def record_metrics(partition: int, task_kwargs: Mapping[str, Any]) -> None:
        event_type = "transactions" if task_kwargs["group_id"] is None else "errors"
        metrics.incr(
            "eventstream.messages",
            tags={"partition": partition, "type": event_type},
        )

    def run_post_process_forwarder(
        self,
        consumer_group,
        commit_log_topic,
        synchronize_commit_group,
        commit_batch_size=100,
        commit_batch_timeout_ms=1000,
        initial_offset_reset="latest",
    ):
        logger.debug("Starting post-process forwarder...")
        cluster_name = settings.KAFKA_TOPICS[settings.KAFKA_EVENTS]["cluster"]

        current_concurrency = options.get("post-process-forwarder:concurrency")
        logger.info(f"Starting post-process-forwarder with {current_concurrency} worker threads")
        executor = ThreadPoolExecutor(max_workers=current_concurrency)

        consumer = SynchronizedConsumer(
            cluster_name=cluster_name,
            consumer_group=consumer_group,
            commit_log_topic=commit_log_topic,
            synchronize_commit_group=synchronize_commit_group,
            initial_offset_reset=initial_offset_reset,
        )

        owned_partition_offsets = {}

        def commit(partitions):
            results = consumer.commit(offsets=partitions, asynchronous=False)

            errors = [i for i in results if i.error is not None]
            if errors:
                raise Exception(
                    "Failed to commit {}/{} partitions: {!r}".format(
                        len(errors), len(partitions), errors
                    )
                )

            return results

        def on_assign(consumer, partitions):
            logger.info("Received partition assignment: %r", partitions)

            for i in partitions:
                if i.offset == OFFSET_INVALID:
                    updated_offset = None
                elif i.offset < 0:
                    raise Exception(
                        f"Received unexpected negative offset during partition assignment: {i!r}"
                    )
                else:
                    updated_offset = i.offset

                key = (i.topic, i.partition)
                previous_offset = owned_partition_offsets.get(key, None)
                if previous_offset is not None and previous_offset != updated_offset:
                    logger.warning(
                        "Received new offset for owned partition %r, will overwrite previous stored offset %r with %r.",
                        key,
                        previous_offset,
                        updated_offset,
                    )

                owned_partition_offsets[key] = updated_offset

        def on_revoke(consumer, partitions):
            logger.info("Revoked partition assignment: %r", partitions)

            offsets_to_commit = []

            for i in partitions:
                key = (i.topic, i.partition)

                try:
                    offset = owned_partition_offsets.pop(key)
                except KeyError:
                    logger.warning(
                        "Received unexpected partition revocation for unowned partition: %r",
                        i,
                        exc_info=True,
                    )
                    continue

                if offset is None:
                    logger.debug("Skipping commit of unprocessed partition: %r", i)
                    continue

                offsets_to_commit.append(TopicPartition(i.topic, i.partition, offset))

            if offsets_to_commit:
                logger.debug(
                    "Committing offset(s) for %s revoked partition(s): %r",
                    len(offsets_to_commit),
                    offsets_to_commit,
                )
                commit(offsets_to_commit)

        consumer.subscribe([self.topic], on_assign=on_assign, on_revoke=on_revoke)

        def commit_offsets() -> None:
            offsets_to_commit = []
            for (topic, partition), offset in owned_partition_offsets.items():
                if offset is None:
                    logger.debug("Skipping commit of unprocessed partition: %r", (topic, partition))
                    continue

                offsets_to_commit.append(TopicPartition(topic, partition, offset))

            if offsets_to_commit:
                logger.debug(
                    "Committing offset(s) for %s owned partition(s): %r",
                    len(offsets_to_commit),
                    offsets_to_commit,
                )
                commit(offsets_to_commit)

        def process_message(message: Message) -> None:
            task_kwargs = self._get_task_kwargs(message)
            if not task_kwargs:
                return

            self.record_metrics(message.partition(), task_kwargs)
            self._pending_futures.append(
                executor.submit(self._dispatch_post_process_group_task, **task_kwargs)
            )

        def collect_results() -> None:
            """
            Collect results from all the pending futures. If any of the futures raised an exception,
            we want to raise it so that the kafka offsets of the current batch don't get committed.
            The batching is either all or none.
            TODO: Add dead letter queue to handle this case.
            """
            for future in as_completed(self._pending_futures):
                exc = future.exception()
                if exc is not None:
                    raise exc
            self.reset_batch()

        shutdown_requested = False

        def handle_shutdown_request(signum: int, frame: Any) -> None:
            nonlocal shutdown_requested
            logger.debug("Received signal %r, requesting shutdown...", signum)
            shutdown_requested = True

        signal.signal(signal.SIGINT, handle_shutdown_request)
        signal.signal(signal.SIGTERM, handle_shutdown_request)

        def run_processing_loop() -> None:
            """
            Runs the processing loop of the post process forwarder. The loop runs until one of the following events
            happens:
            1. Commit batch size is reached
            2. Commit batch timeout is reached.
            When either of those events occur, we wait for all pending work to complete and then commit the offsets
            to kafka.
            """
            nonlocal shutdown_requested
            loop_count = 0
            while not shutdown_requested:
                if self._pending_futures and (
                    (loop_count == commit_batch_size)
                    or (
                        (int(time.time() * 1000) - self._batch_create_time_ms)
                        >= commit_batch_timeout_ms
                    )
                ):
                    collect_results()
                    commit_offsets()
                    return

                message = consumer.poll(0.1)
                if message is None:
                    continue

                error = message.error()
                if error is not None:
                    raise Exception(error)

                key = (message.topic(), message.partition())
                if key not in owned_partition_offsets:
                    logger.warning("Skipping message for unowned partition: %r", key)
                    continue

                loop_count = loop_count + 1
                owned_partition_offsets[key] = message.offset() + 1
                process_message(message)

        # The main loop of the function. It will run until shutdown is requested.
        # There is an option provided which can switch the number of threads used.
        # We don't want to switch while running inside the implementation loop since
        # that would increase code complexity.
        while not shutdown_requested:
            new_concurrency = options.get("post-process-forwarder:concurrency")
            if new_concurrency != current_concurrency:
                logger.info(f"Switching post-process-forwarder to {new_concurrency} worker threads")
                executor.shutdown(wait=True)
                executor = ThreadPoolExecutor(max_workers=new_concurrency)
                current_concurrency = new_concurrency

            run_processing_loop()

        logger.debug("Committing offsets and closing consumer...")
        if self._pending_futures:
            collect_results()
            commit_offsets()
        executor.shutdown()
        consumer.close()

    def _get_task_kwargs(self, message: Message) -> Optional[Mapping[str, Any]]:
        use_kafka_headers = options.get("post-process-forwarder:kafka-headers")

        if use_kafka_headers:
            try:
                with self.sampled_eventstream_timer(
                    instance="get_task_kwargs_for_message_from_headers"
                ):
                    return get_task_kwargs_for_message_from_headers(message.headers())
            except Exception as error:
                logger.error("Could not forward message: %s", error, exc_info=True)
                with metrics.timer(__DURATION_METRIC__, instance="get_task_kwargs_for_message"):
                    return get_task_kwargs_for_message(message.value())
        else:
            with metrics.timer(__DURATION_METRIC__, instance="get_task_kwargs_for_message"):
                return get_task_kwargs_for_message(message.value())

    @contextmanager
    def sampled_eventstream_timer(self, instance: str) -> Generator[None, None, None]:
        record_metric = random.random() < 0.1
        if record_metric is True:
            with metrics.timer(__DURATION_METRIC__, instance=instance):
                yield
        else:
            yield
