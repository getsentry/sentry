import logging
import signal
from typing import Any, Mapping, Optional, Tuple

from confluent_kafka import OFFSET_INVALID, TopicPartition
from django.conf import settings
from django.utils.functional import cached_property

from sentry import options
from sentry.eventstream.kafka.consumer import SynchronizedConsumer
from sentry.eventstream.kafka.postprocessworker import (
    _CONCURRENCY_OPTION,
    ErrorsPostProcessForwarderWorker,
    PostProcessForwarderType,
    PostProcessForwarderWorker,
    TransactionsPostProcessForwarderWorker,
    _sampled_eventstream_timer,
)
from sentry.eventstream.kafka.protocol import (
    get_task_kwargs_for_message,
    get_task_kwargs_for_message_from_headers,
)
from sentry.eventstream.snuba import SnubaProtocolEventStream
from sentry.utils import json, kafka, metrics
from sentry.utils.batching_kafka_consumer import BatchingKafkaConsumer

logger = logging.getLogger(__name__)


class KafkaEventStream(SnubaProtocolEventStream):
    def __init__(self, **options):
        self.topic = settings.KAFKA_TOPICS[settings.KAFKA_EVENTS]["topic"]

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

        # TODO: Change transaction_forwarder to be intelligent once transaction post process forwarder
        #       is implemented and caught up with current events post process forwarder.
        transaction_forwarder = False

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
                    "transaction_forwarder": encode_bool(transaction_forwarder),
                }
            )
        else:
            return {
                **super()._get_headers_for_insert(
                    group,
                    event,
                    is_new,
                    is_regression,
                    is_new_group_environment,
                    primary_hash,
                    received_timestamp,
                    skip_consume,
                ),
                "transaction_forwarder": encode_bool(transaction_forwarder),
            }

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

    def _build_consumer(
        self,
        entity,
        consumer_group,
        commit_log_topic,
        synchronize_commit_group,
        commit_batch_size=100,
        commit_batch_timeout_ms=5000,
        initial_offset_reset="latest",
    ):
        cluster_name = settings.KAFKA_TOPICS[settings.KAFKA_EVENTS]["cluster"]

        synchronized_consumer = SynchronizedConsumer(
            cluster_name=cluster_name,
            consumer_group=consumer_group,
            commit_log_topic=commit_log_topic,
            synchronize_commit_group=synchronize_commit_group,
            initial_offset_reset=initial_offset_reset,
        )

        concurrency = options.get(_CONCURRENCY_OPTION)
        logger.info(f"Starting post process forwrader to consume {entity} messages")
        if entity == PostProcessForwarderType.TRANSACTIONS:
            worker = TransactionsPostProcessForwarderWorker(concurrency=concurrency)
        elif entity == PostProcessForwarderType.ERRORS:
            worker = ErrorsPostProcessForwarderWorker(concurrency=concurrency)
        else:
            # Default implementation which processes both errors and transactions
            # irrespective of values in the header. This would most likely be the case
            # for development environments.
            worker = PostProcessForwarderWorker(concurrency=concurrency)

        consumer = BatchingKafkaConsumer(
            topics=self.topic,
            worker=worker,
            max_batch_size=commit_batch_size,
            max_batch_time=commit_batch_timeout_ms,
            consumer=synchronized_consumer,
            commit_on_shutdown=True,
        )
        return consumer

    def run_batched_consumer(
        self,
        entity,
        consumer_group,
        commit_log_topic,
        synchronize_commit_group,
        commit_batch_size=100,
        commit_batch_timeout_ms=5000,
        initial_offset_reset="latest",
    ):
        consumer = self._build_consumer(
            entity,
            consumer_group,
            commit_log_topic,
            synchronize_commit_group,
            commit_batch_size,
            commit_batch_timeout_ms,
            initial_offset_reset,
        )

        def handler(signum, frame):
            consumer.signal_shutdown()

        signal.signal(signal.SIGINT, handler)
        signal.signal(signal.SIGTERM, handler)

        consumer.run()

    def run_streaming_consumer(
        self,
        consumer_group,
        commit_log_topic,
        synchronize_commit_group,
        commit_batch_size=100,
        initial_offset_reset="latest",
    ):
        cluster_name = settings.KAFKA_TOPICS[settings.KAFKA_EVENTS]["cluster"]

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

        def commit_offsets():
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

        shutdown_requested = False

        def handle_shutdown_request(signum: int, frame: Any) -> None:
            nonlocal shutdown_requested
            logger.debug("Received signal %r, requesting shutdown...", signum)
            shutdown_requested = True

        signal.signal(signal.SIGINT, handle_shutdown_request)
        signal.signal(signal.SIGTERM, handle_shutdown_request)

        i = 0
        while not shutdown_requested:
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

            i = i + 1
            owned_partition_offsets[key] = message.offset() + 1

            use_kafka_headers = options.get("post-process-forwarder:kafka-headers")

            if use_kafka_headers is True:
                try:
                    with _sampled_eventstream_timer(
                        instance="get_task_kwargs_for_message_from_headers"
                    ):
                        task_kwargs = get_task_kwargs_for_message_from_headers(message.headers())

                    if task_kwargs is not None:
                        with _sampled_eventstream_timer(
                            instance="dispatch_post_process_group_task"
                        ):
                            if task_kwargs["group_id"] is None:
                                metrics.incr(
                                    "eventstream.messages",
                                    tags={"partition": message.partition(), "type": "transactions"},
                                )
                            else:
                                metrics.incr(
                                    "eventstream.messages",
                                    tags={"partition": message.partition(), "type": "errors"},
                                )
                            self._dispatch_post_process_group_task(**task_kwargs)

                except Exception as error:
                    logger.error("Could not forward message: %s", error, exc_info=True)
                    self._get_task_kwargs_and_dispatch(message)

            else:
                self._get_task_kwargs_and_dispatch(message)

            if i % commit_batch_size == 0:
                commit_offsets()

        logger.debug("Committing offsets and closing consumer...")
        commit_offsets()

        consumer.close()

    def _get_task_kwargs_and_dispatch(self, message) -> None:
        with metrics.timer("eventstream.duration", instance="get_task_kwargs_for_message"):
            task_kwargs = get_task_kwargs_for_message(message.value())

        if task_kwargs is not None:
            if task_kwargs["group_id"] is None:
                metrics.incr(
                    "eventstream.messages",
                    tags={"partition": message.partition(), "type": "transactions"},
                )
            else:
                metrics.incr(
                    "eventstream.messages",
                    tags={"partition": message.partition(), "type": "errors"},
                )
            with metrics.timer("eventstream.duration", instance="dispatch_post_process_group_task"):
                self._dispatch_post_process_group_task(**task_kwargs)

    def run_post_process_forwarder(
        self,
        entity,
        consumer_group,
        commit_log_topic,
        synchronize_commit_group,
        commit_batch_size=100,
        commit_batch_timeout_ms=5000,
        initial_offset_reset="latest",
    ):
        logger.debug("Starting post-process forwarder...")

        if settings.SENTRY_POST_PROCESS_FORWARDER_BATCHING:
            logger.info("Starting batching consumer")
            self.run_batched_consumer(
                entity,
                consumer_group,
                commit_log_topic,
                synchronize_commit_group,
                commit_batch_size,
                commit_batch_timeout_ms,
                initial_offset_reset,
            )
        else:
            logger.info("Starting streaming consumer")
            self.run_streaming_consumer(
                consumer_group,
                commit_log_topic,
                synchronize_commit_group,
                commit_batch_size,
                initial_offset_reset,
            )
