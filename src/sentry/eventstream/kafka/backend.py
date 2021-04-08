import logging
import signal
from typing import Any

from confluent_kafka import OFFSET_INVALID, TopicPartition
from django.conf import settings
from django.utils.functional import cached_property

from sentry.eventstream.kafka.consumer import SynchronizedConsumer
from sentry.eventstream.kafka.protocol import get_task_kwargs_for_message
from sentry.eventstream.snuba import SnubaProtocolEventStream
from sentry.utils import json, kafka, metrics

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

    def _send(
        self,
        project_id,
        _type,
        extra_data=(),
        asynchronous=True,
        headers=None,  # Optional[Mapping[str, str]]
    ):
        if headers is None:
            headers = {}

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

    def run_post_process_forwarder(
        self,
        consumer_group,
        commit_log_topic,
        synchronize_commit_group,
        commit_batch_size=100,
        initial_offset_reset="latest",
    ):
        logger.debug("Starting post-process forwarder...")

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

            with metrics.timer("eventstream.duration", instance="get_task_kwargs_for_message"):
                task_kwargs = get_task_kwargs_for_message(message.value())

            if task_kwargs is not None:
                with metrics.timer(
                    "eventstream.duration", instance="dispatch_post_process_group_task"
                ):
                    self._dispatch_post_process_group_task(**task_kwargs)

            if i % commit_batch_size == 0:
                commit_offsets()

        logger.debug("Committing offsets and closing consumer...")
        commit_offsets()

        consumer.close()
