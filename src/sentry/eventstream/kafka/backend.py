import logging
import signal
from typing import Any, Mapping, Optional, Tuple

from django.conf import settings
from django.utils.functional import cached_property

from sentry import options
from sentry.eventstream.kafka.consumer import SynchronizedConsumer
from sentry.eventstream.kafka.postprocessworker import (
    _CONCURRENCY_OPTION,
    PostProcessForwarderWorker,
)
from sentry.eventstream.snuba import SnubaProtocolEventStream
from sentry.utils import json, kafka
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

    def _build_consumer(
        self,
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

    def run_post_process_forwarder(
        self,
        consumer_group,
        commit_log_topic,
        synchronize_commit_group,
        commit_batch_size=100,
        commit_batch_timeout_ms=5000,
        initial_offset_reset="latest",
    ):
        logger.debug("Starting post-process forwarder...")

        consumer = self._build_consumer(
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
