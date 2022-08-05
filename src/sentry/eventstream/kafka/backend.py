import logging
import signal
from typing import Any, Literal, Mapping, Optional, Tuple, Union

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
)
from sentry.eventstream.snuba import KW_SKIP_SEMANTIC_PARTITIONING, SnubaProtocolEventStream
from sentry.killswitches import killswitch_matches_context
from sentry.utils import json, kafka
from sentry.utils.batching_kafka_consumer import BatchingKafkaConsumer

logger = logging.getLogger(__name__)


class KafkaEventStream(SnubaProtocolEventStream):
    def __init__(self, **options):
        self.topic = settings.KAFKA_EVENTS
        self.transactions_topic = settings.KAFKA_TRANSACTIONS
        self.assign_transaction_partitions_randomly = options.get(
            "kafka.partition-transactions-randomly"
        )

    @cached_property
    def producer(self):
        # TODO: The producer is currently hardcoded to KAFKA_EVENTS. This assumes that the transactions
        # topic is either the same (or is on the same cluster) as the events topic. Since we are in the
        # process of splitting the topic this will no longer be true. This should be fixed and we should
        # drop this requirement when the KafkaEventStream is refactored to be agnostic of dataset specific
        # details and the correct topic should be passed into here instead of hardcoding events.
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

        # we strip `None` values here so later in the pipeline they can be
        # cleanly encoded without nullability checks
        def strip_none_values(value: Mapping[str, Optional[str]]) -> Mapping[str, str]:
            return {key: value for key, value in value.items() if value is not None}

        # transaction_forwarder header is not sent if option "eventstream:kafka-headers"
        # is not set to avoid increasing consumer lag on shared events topic.
        transaction_forwarder = self._is_transaction_event(event)

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
            }

    def insert(
        self,
        group,
        event,
        is_new,
        is_regression,
        is_new_group_environment,
        primary_hash,
        received_timestamp: float,
        skip_consume=False,
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
            group,
            event,
            is_new,
            is_regression,
            is_new_group_environment,
            primary_hash,
            received_timestamp,
            skip_consume,
            **kwargs,
        )

    def _send(
        self,
        project_id: int,
        _type: str,
        extra_data: Tuple[Any, ...] = (),
        asynchronous: bool = True,
        headers: Optional[Mapping[str, str]] = None,
        skip_semantic_partitioning: bool = False,
        is_transaction_event: bool = False,
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

        try:
            topic = self.transactions_topic if is_transaction_event else self.topic

            self.producer.produce(
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
            self.producer.flush()

    def requires_post_process_forwarder(self):
        return True

    def _build_consumer(
        self,
        entity: Union[Literal["all"], Literal["errors"], Literal["transactions"]],
        consumer_group: str,
        topic: Optional[str],
        commit_log_topic: str,
        synchronize_commit_group: str,
        commit_batch_size: int = 100,
        commit_batch_timeout_ms: int = 5000,
        initial_offset_reset: Union[Literal["latest"], Literal["earliest"]] = "latest",
    ):
        concurrency = options.get(_CONCURRENCY_OPTION)
        logger.info(f"Starting post process forwarder to consume {entity} messages")
        if entity == PostProcessForwarderType.TRANSACTIONS:
            cluster_name = settings.KAFKA_TOPICS[settings.KAFKA_TRANSACTIONS]["cluster"]
            worker = TransactionsPostProcessForwarderWorker(concurrency=concurrency)
            default_topic = self.transactions_topic
        elif entity == PostProcessForwarderType.ERRORS:
            cluster_name = settings.KAFKA_TOPICS[settings.KAFKA_EVENTS]["cluster"]
            worker = ErrorsPostProcessForwarderWorker(concurrency=concurrency)
            default_topic = self.topic
        else:
            # Default implementation which processes both errors and transactions
            # irrespective of values in the header. This would most likely be the case
            # for development environments. For the combined post process forwarder
            # to work KAFKA_EVENTS and KAFKA_TRANSACTIONS must be the same currently.
            cluster_name = settings.KAFKA_TOPICS[settings.KAFKA_EVENTS]["cluster"]
            assert cluster_name == settings.KAFKA_TOPICS[settings.KAFKA_TRANSACTIONS]["cluster"]
            worker = PostProcessForwarderWorker(concurrency=concurrency)
            default_topic = self.topic
            assert self.topic == self.transactions_topic

        synchronized_consumer = SynchronizedConsumer(
            cluster_name=cluster_name,
            consumer_group=consumer_group,
            commit_log_topic=commit_log_topic,
            synchronize_commit_group=synchronize_commit_group,
            initial_offset_reset=initial_offset_reset,
        )

        consumer = BatchingKafkaConsumer(
            topics=topic or default_topic,
            worker=worker,
            max_batch_size=commit_batch_size,
            max_batch_time=commit_batch_timeout_ms,
            consumer=synchronized_consumer,
            commit_on_shutdown=True,
        )
        return consumer

    def run_batched_consumer(
        self,
        entity: Union[Literal["all"], Literal["errors"], Literal["transactions"]],
        consumer_group: str,
        topic: Optional[str],
        commit_log_topic: str,
        synchronize_commit_group: str,
        commit_batch_size: int = 100,
        commit_batch_timeout_ms: int = 5000,
        initial_offset_reset: Union[Literal["latest"], Literal["earliest"]] = "latest",
    ):
        consumer = self._build_consumer(
            entity,
            consumer_group,
            topic,
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

    def run_post_process_forwarder(
        self,
        entity: Union[Literal["all"], Literal["errors"], Literal["transactions"]],
        consumer_group: str,
        topic: Optional[str],
        commit_log_topic: str,
        synchronize_commit_group: str,
        commit_batch_size: int = 100,
        commit_batch_timeout_ms: int = 5000,
        initial_offset_reset: Union[Literal["latest"], Literal["earliest"]] = "latest",
    ):
        logger.debug("Starting post-process forwarder...")

        self.run_batched_consumer(
            entity,
            consumer_group,
            topic,
            commit_log_topic,
            synchronize_commit_group,
            commit_batch_size,
            commit_batch_timeout_ms,
            initial_offset_reset,
        )
