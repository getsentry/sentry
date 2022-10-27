import logging
import signal
import uuid
from typing import Any, Literal, Mapping, MutableMapping, Optional, Sequence, Tuple, Union

from arroyo import Topic, configure_metrics
from arroyo.backends.kafka.configuration import build_kafka_consumer_configuration
from arroyo.backends.kafka.consumer import KafkaConsumer, KafkaPayload
from arroyo.commit import ONCE_PER_SECOND
from arroyo.processing.processor import StreamProcessor
from confluent_kafka import Producer
from django.conf import settings

from sentry import options
from sentry.eventstream.base import GroupStates
from sentry.eventstream.kafka.consumer import SynchronizedConsumer
from sentry.eventstream.kafka.consumer_strategy import PostProcessForwarderStrategyFactory
from sentry.eventstream.kafka.postprocessworker import (
    PostProcessForwarderType,
    PostProcessForwarderWorker,
)
from sentry.eventstream.kafka.synchronized import SynchronizedConsumer as ArroyoSynchronizedConsumer
from sentry.eventstream.snuba import KW_SKIP_SEMANTIC_PARTITIONING, SnubaProtocolEventStream
from sentry.killswitches import killswitch_matches_context
from sentry.sentry_metrics.metrics_wrapper import MetricsWrapper
from sentry.utils import json, kafka, metrics
from sentry.utils.batching_kafka_consumer import BatchingKafkaConsumer
from sentry.utils.kafka_config import get_kafka_consumer_cluster_options

logger = logging.getLogger(__name__)


class KafkaEventStream(SnubaProtocolEventStream):
    def __init__(self, **options: Any) -> None:
        self.topic = settings.KAFKA_EVENTS
        self.transactions_topic = settings.KAFKA_TRANSACTIONS
        self.assign_transaction_partitions_randomly = True

    def get_transactions_topic(self, project_id: int) -> str:
        return self.transactions_topic

    def get_producer(self, topic: str) -> Producer:
        return kafka.producers.get(topic)

    def delivery_callback(self, error, message):
        if error is not None:
            logger.warning("Could not publish message (error: %s): %r", error, message)

    def _get_headers_for_insert(
        self,
        event,
        is_new,
        is_regression,
        is_new_group_environment,
        primary_hash,
        received_timestamp: float,
        skip_consume,
        group_states: Optional[GroupStates] = None,
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

        def encode_list(value: Sequence[Any]) -> str:
            return json.dumps(value)

        # we strip `None` values here so later in the pipeline they can be
        # cleanly encoded without nullability checks
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
                    "group_states": encode_list(group_states) if group_states is not None else None,
                    "queue": self._get_queue_for_post_process(event),
                }
            )
        else:
            return {
                **super()._get_headers_for_insert(
                    event,
                    is_new,
                    is_regression,
                    is_new_group_environment,
                    primary_hash,
                    received_timestamp,
                    skip_consume,
                ),
            }

    def insert(
        self,
        event,
        is_new,
        is_regression,
        is_new_group_environment,
        primary_hash,
        received_timestamp: float,
        skip_consume=False,
        group_states: Optional[GroupStates] = None,
        **kwargs,
    ):
        message_type = "transaction" if self._is_transaction_event(event) else "error"

        if message_type == "transaction" and self.assign_transaction_partitions_randomly:
            assign_partitions_randomly = True
        else:
            assign_partitions_randomly = killswitch_matches_context(
                "kafka.send-project-events-to-random-partitions",
                {"project_id": event.project_id, "message_type": message_type},
            )

        if assign_partitions_randomly:
            kwargs[KW_SKIP_SEMANTIC_PARTITIONING] = True

        return super().insert(
            event,
            is_new,
            is_regression,
            is_new_group_environment,
            primary_hash,
            received_timestamp,
            skip_consume,
            group_states,
            **kwargs,
        )

    def _send(
        self,
        project_id: int,
        _type: str,
        extra_data: Tuple[Any, ...] = (),
        asynchronous: bool = True,
        headers: Optional[MutableMapping[str, str]] = None,
        skip_semantic_partitioning: bool = False,
        is_transaction_event: bool = False,
    ) -> None:
        if headers is None:
            headers = {}
        headers["operation"] = _type
        headers["version"] = str(self.EVENT_PROTOCOL_VERSION)

        if is_transaction_event:
            topic = self.get_transactions_topic(project_id)
        else:
            topic = self.topic

        producer = self.get_producer(topic)

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
        producer.poll(0.0)

        assert isinstance(extra_data, tuple)

        try:
            producer.produce(
                topic=topic,
                key=str(project_id).encode("utf-8") if not skip_semantic_partitioning else None,
                value=json.dumps((self.EVENT_PROTOCOL_VERSION, _type) + extra_data),
                on_delivery=self.delivery_callback,
                headers=[(k, v.encode("utf-8")) for k, v in headers.items()],
            )
        except Exception as error:
            logger.error("Could not publish message: %s", error, exc_info=True)
            return

        if not asynchronous:
            # flush() is a convenience method that calls poll() until len() is zero
            producer.flush()

    def requires_post_process_forwarder(self):
        return True

    def _build_consumer(
        self,
        consumer_group: str,
        topic: str,
        commit_log_topic: str,
        synchronize_commit_group: str,
        commit_batch_size: int,
        commit_batch_timeout_ms: int,
        concurrency: int,
        initial_offset_reset: Union[Literal["latest"], Literal["earliest"]],
    ):
        worker = PostProcessForwarderWorker(concurrency=concurrency)

        cluster_name = settings.KAFKA_TOPICS[topic]["cluster"]

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
        return consumer

    def _build_streaming_consumer(
        self,
        consumer_group: str,
        topic: str,
        commit_log_topic: str,
        synchronize_commit_group: str,
        commit_batch_size: int,
        commit_batch_timeout_ms: int,
        concurrency: int,
        initial_offset_reset: Union[Literal["latest"], Literal["earliest"]],
        strict_offset_reset: Optional[bool],
    ) -> StreamProcessor[KafkaPayload]:
        configure_metrics(MetricsWrapper(metrics.backend))

        cluster_name = settings.KAFKA_TOPICS[topic]["cluster"]

        consumer = KafkaConsumer(
            build_kafka_consumer_configuration(
                get_kafka_consumer_cluster_options(cluster_name),
                group_id=consumer_group,
                auto_offset_reset=initial_offset_reset,
                strict_offset_reset=strict_offset_reset,
            )
        )

        commit_log_consumer = KafkaConsumer(
            build_kafka_consumer_configuration(
                get_kafka_consumer_cluster_options(cluster_name),
                group_id=f"ppf-commit-log-{uuid.uuid1().hex}",
                auto_offset_reset="earliest",
            )
        )

        synchronized_consumer = ArroyoSynchronizedConsumer(
            consumer=consumer,
            commit_log_consumer=commit_log_consumer,
            commit_log_topic=Topic(commit_log_topic),
            commit_log_groups={synchronize_commit_group},
        )

        strategy_factory = PostProcessForwarderStrategyFactory(concurrency, commit_batch_size)

        return StreamProcessor(
            synchronized_consumer, Topic(topic), strategy_factory, ONCE_PER_SECOND
        )

    def run_consumer(
        self,
        entity: Union[Literal["errors"], Literal["transactions"]],
        consumer_group: str,
        topic: Optional[str],
        commit_log_topic: str,
        synchronize_commit_group: str,
        commit_batch_size: int,
        commit_batch_timeout_ms: int,
        concurrency: int,
        initial_offset_reset: Union[Literal["latest"], Literal["earliest"]],
        strict_offset_reset: Optional[bool],
        use_streaming_consumer: bool,
    ) -> None:

        logger.info(f"Starting post process forwarder to consume {entity} messages")
        if entity == PostProcessForwarderType.TRANSACTIONS:
            default_topic = self.transactions_topic
        elif entity == PostProcessForwarderType.ERRORS:
            default_topic = self.topic
        else:
            raise ValueError("Invalid entity")

        if use_streaming_consumer:
            consumer = self._build_streaming_consumer(
                consumer_group,
                topic or default_topic,
                commit_log_topic,
                synchronize_commit_group,
                commit_batch_size,
                commit_batch_timeout_ms,
                concurrency,
                initial_offset_reset,
                strict_offset_reset,
            )
        else:
            consumer = self._build_consumer(
                consumer_group,
                topic or default_topic,
                commit_log_topic,
                synchronize_commit_group,
                commit_batch_size,
                commit_batch_timeout_ms,
                concurrency,
                initial_offset_reset,
            )

        def handler(signum, frame):
            consumer.signal_shutdown()

        signal.signal(signal.SIGINT, handler)
        signal.signal(signal.SIGTERM, handler)

        consumer.run()

    def run_post_process_forwarder(
        self,
        entity: Union[Literal["errors"], Literal["transactions"]],
        consumer_group: str,
        topic: Optional[str],
        commit_log_topic: str,
        synchronize_commit_group: str,
        commit_batch_size: int,
        commit_batch_timeout_ms: int,
        concurrency: int,
        initial_offset_reset: Union[Literal["latest"], Literal["earliest"]],
        strict_offset_reset: bool,
        use_streaming_consumer: bool,
    ):
        logger.debug("Starting post-process forwarder...")

        self.run_consumer(
            entity,
            consumer_group,
            topic,
            commit_log_topic,
            synchronize_commit_group,
            commit_batch_size,
            commit_batch_timeout_ms,
            concurrency,
            initial_offset_reset,
            strict_offset_reset,
            use_streaming_consumer,
        )
