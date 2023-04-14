import logging
import signal
import uuid
from enum import Enum
from typing import Any, Callable, Literal, Mapping, MutableMapping, Optional, Union

from arroyo import configure_metrics
from arroyo.backends.kafka import KafkaConsumer, KafkaPayload
from arroyo.backends.kafka.configuration import build_kafka_consumer_configuration
from arroyo.commit import ONCE_PER_SECOND
from arroyo.processing import StreamProcessor
from arroyo.processing.strategies import (
    CommitOffsets,
    ProcessingStrategy,
    ProcessingStrategyFactory,
    RunTaskInThreads,
)
from arroyo.types import Commit, Message, Partition, Topic
from confluent_kafka import Producer
from django.conf import settings

from sentry.post_process_forwarder.synchronized import SynchronizedConsumer
from sentry.utils import metrics
from sentry.utils.arroyo import MetricsWrapper
from sentry.utils.kafka_config import get_kafka_consumer_cluster_options

logger = logging.getLogger(__name__)


class PostProcessForwarderType(str, Enum):
    ERRORS = "errors"
    TRANSACTIONS = "transactions"
    ISSUE_PLATFORM = "search_issues"


class PostProcessForwarder:
    """
    The `dispatch_function` should take a message and dispatch the post_process_group
    celery task
    """

    def __init__(self, dispatch_function: Callable[[Message[KafkaPayload]], None]) -> None:
        self.dispatch_function = dispatch_function
        self.topic = settings.KAFKA_EVENTS
        self.transactions_topic = settings.KAFKA_TRANSACTIONS
        self.issue_platform_topic = settings.KAFKA_EVENTSTREAM_GENERIC
        self.assign_transaction_partitions_randomly = True
        self.__producers: MutableMapping[str, Producer] = {}

    def run(
        self,
        entity: PostProcessForwarderType,
        consumer_group: str,
        topic: Optional[str],
        commit_log_topic: str,
        synchronize_commit_group: str,
        concurrency: int,
        initial_offset_reset: Union[Literal["latest"], Literal["earliest"]],
        strict_offset_reset: bool,
    ) -> None:

        logger.debug(f"Starting post process forwarder to consume {entity} messages")
        if entity == PostProcessForwarderType.TRANSACTIONS:
            default_topic = self.transactions_topic
        elif entity == PostProcessForwarderType.ERRORS:
            default_topic = self.topic
        elif entity == PostProcessForwarderType.ISSUE_PLATFORM:
            default_topic = self.issue_platform_topic
        else:
            raise ValueError("Invalid entity")

        consumer = self._build_streaming_consumer(
            consumer_group,
            topic or default_topic,
            commit_log_topic,
            synchronize_commit_group,
            concurrency,
            initial_offset_reset,
            strict_offset_reset,
        )

        def handler(signum: int, frame: Any) -> None:
            consumer.signal_shutdown()
            for producer in self.__producers.values():
                producer.flush()

        signal.signal(signal.SIGINT, handler)
        signal.signal(signal.SIGTERM, handler)

        consumer.run()

    def _build_streaming_consumer(
        self,
        consumer_group: str,
        topic: str,
        commit_log_topic: str,
        synchronize_commit_group: str,
        concurrency: int,
        initial_offset_reset: Union[Literal["latest"], Literal["earliest"]],
        strict_offset_reset: Optional[bool],
    ) -> StreamProcessor[KafkaPayload]:
        configure_metrics(MetricsWrapper(metrics.backend, name="eventstream"))

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

        synchronized_consumer = SynchronizedConsumer(
            consumer=consumer,
            commit_log_consumer=commit_log_consumer,
            commit_log_topic=Topic(commit_log_topic),
            commit_log_groups={synchronize_commit_group},
        )

        strategy_factory = PostProcessForwarderStrategyFactory(self.dispatch_function, concurrency)

        return StreamProcessor(
            synchronized_consumer, Topic(topic), strategy_factory, ONCE_PER_SECOND
        )


class PostProcessForwarderStrategyFactory(ProcessingStrategyFactory[KafkaPayload]):
    def __init__(
        self, dispatch_function: Callable[[Message[KafkaPayload]], None], concurrency: int
    ):
        self.__dispatch_function = dispatch_function
        self.__concurrency = concurrency
        self.__max_pending_futures = concurrency + 1000

    def create_with_partitions(
        self,
        commit: Commit,
        partitions: Mapping[Partition, int],
    ) -> ProcessingStrategy[KafkaPayload]:
        return RunTaskInThreads(
            self.__dispatch_function,
            self.__concurrency,
            self.__max_pending_futures,
            CommitOffsets(commit),
        )
