import logging
import signal
from typing import Any, Callable, Literal, Mapping, Optional, Tuple, Union

from django.conf import settings
from django.utils.functional import cached_property

from sentry import options
from sentry.eventstream.abstract import EventStreamBackend
from sentry.eventstream.kafka.consumer import SynchronizedConsumer
from sentry.eventstream.kafka.postprocessworker import (
    _CONCURRENCY_OPTION,
    PostProcessForwarderWorker,
)
from sentry.eventstream.kafka.protocol import get_task_kwargs_for_message
from sentry.eventstream.utils import EVENT_PROTOCOL_VERSION
from sentry.utils import json, kafka, metrics
from sentry.utils.batching_kafka_consumer import BatchingKafkaConsumer

logger = logging.getLogger(__name__)

DATASET_MESSAGE_TYPE = {"transactions": "transaction", "events": "error"}


class KafkaEventStreamBackend(EventStreamBackend):
    def __init__(
        self,
        topic: str,
        worker: PostProcessForwarderWorker,
        assign_partitions_randomly: Callable[[int], bool],
    ):
        self.topic = topic
        self.worker = worker
        self.assign_partitions_randomly = assign_partitions_randomly

    @cached_property
    def producer(self):
        return kafka.producers.get(self.topic)

    def delivery_callback(self, error, message):
        if error is not None:
            logger.warning("Could not publish message (error: %s): %r", error, message)

    def send(
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
        headers["version"] = str(EVENT_PROTOCOL_VERSION)

        skip_semantic_partitioning = self.assign_partitions_randomly(project_id)

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

        try:
            self.producer.produce(
                topic=self.topic,
                key=str(project_id).encode("utf-8") if not skip_semantic_partitioning else None,
                value=json.dumps((EVENT_PROTOCOL_VERSION, _type) + extra_data),
                on_delivery=self.delivery_callback,
                headers=[(k, v.encode("utf-8")) for k, v in headers.items()],
            )
        except Exception as error:
            logger.error("Could not publish message: %s", error, exc_info=True)
            return

        if not asynchronous:
            # flush() is a convenience method that calls poll() until len() is zero
            self.producer.flush()

    def requires_post_process_forwarder(self) -> bool:
        return True

    def run_forwarder(
        self,
        consumer_group: str,
        commit_log_topic: str,
        synchronize_commit_group: str,
        commit_batch_size: int,
        commit_batch_timeout_ms: int,
        initial_offset_reset: Union[Literal["latest"], Literal["earliest"]],
    ):
        forwarder = KafkaPostProcessForwarder(self.topic, self.worker)

        forwarder.run(
            consumer_group=consumer_group,
            commit_log_topic=commit_log_topic,
            synchronize_commit_group=synchronize_commit_group,
            commit_batch_size=commit_batch_size,
            commit_batch_timeout_ms=commit_batch_timeout_ms,
            initial_offset_reset=initial_offset_reset,
        )


class KafkaPostProcessForwarder:
    def __init__(
        self,
        topic: str,
        worker: PostProcessForwarderWorker,
    ):
        self.topic = topic
        self.worker = worker

    def run(
        self,
        consumer_group: str,
        commit_log_topic: str,
        synchronize_commit_group: str,
        commit_batch_size: int = 100,
        commit_batch_timeout_ms: int = 5000,
        initial_offset_reset: Union[Literal["latest"], Literal["earliest"]] = "latest",
    ):
        concurrency = options.get(_CONCURRENCY_OPTION)
        logger.info(f"Starting post process forwarder to consume messages from {self.topic}")

        cluster_name = settings.KAFKA_TOPICS[self.topic]["cluster"]
        worker = self.worker(concurrency=concurrency)
        topic = self.topic

        synchronized_consumer = SynchronizedConsumer(
            cluster_name=cluster_name,
            consumer_group=consumer_group,
            commit_log_topic=commit_log_topic,
            synchronize_commit_group=synchronize_commit_group,
            initial_offset_reset=initial_offset_reset,
        )

        consumer = BatchingKafkaConsumer(
            topics=topic,
            worker=worker,
            max_batch_size=commit_batch_size,
            max_batch_time=commit_batch_timeout_ms,
            consumer=synchronized_consumer,
            commit_on_shutdown=True,
        )

        def handler(signum, frame):
            consumer.signal_shutdown()

        signal.signal(signal.SIGINT, handler)
        signal.signal(signal.SIGTERM, handler)

        consumer.run()

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
