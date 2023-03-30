import logging
from random import random
from typing import Callable, Dict, Mapping, cast

import pytz
import sentry_sdk
from arroyo import Topic, configure_metrics
from arroyo.backends.kafka.configuration import build_kafka_consumer_configuration
from arroyo.backends.kafka.consumer import KafkaConsumer, KafkaPayload
from arroyo.commit import ONCE_PER_SECOND
from arroyo.processing.processor import StreamProcessor
from arroyo.processing.strategies import (
    CommitOffsets,
    ProcessingStrategy,
    ProcessingStrategyFactory,
    RunTask,
)
from arroyo.processing.strategies.decoder.base import ValidationError
from arroyo.processing.strategies.decoder.json import JsonCodec
from arroyo.types import BrokerValue, Commit, Message, Partition
from dateutil.parser import parse as parse_date
from django.conf import settings
from sentry_kafka_schemas import get_schema
from sentry_kafka_schemas.schema_types.events_subscription_results_v1 import (
    PayloadV3,
    SubscriptionResult,
)

from sentry import options
from sentry.incidents.subscription_processor import SubscriptionUpdate
from sentry.snuba.dataset import Dataset, EntityKey
from sentry.snuba.models import QuerySubscription
from sentry.snuba.tasks import _delete_from_snuba
from sentry.utils import kafka_config, metrics
from sentry.utils.arroyo import MetricsWrapper

logger = logging.getLogger(__name__)
TQuerySubscriptionCallable = Callable[[SubscriptionUpdate, QuerySubscription], None]

subscriber_registry: Dict[str, TQuerySubscriptionCallable] = {}

topic_to_dataset: Dict[str, Dataset] = {
    settings.KAFKA_EVENTS_SUBSCRIPTIONS_RESULTS: Dataset.Events,
    settings.KAFKA_TRANSACTIONS_SUBSCRIPTIONS_RESULTS: Dataset.Transactions,
    settings.KAFKA_GENERIC_METRICS_SUBSCRIPTIONS_RESULTS: Dataset.PerformanceMetrics,
    settings.KAFKA_SESSIONS_SUBSCRIPTIONS_RESULTS: Dataset.Sessions,
    settings.KAFKA_METRICS_SUBSCRIPTIONS_RESULTS: Dataset.Metrics,
}

dataset_to_logical_topic = {
    Dataset.Events: "events-subscription-results",
    Dataset.Transactions: "transactions-subscription-results",
    Dataset.PerformanceMetrics: "generic-metrics-subscription-results",
    Dataset.Sessions: "sessions-subscription-results",
    Dataset.Metrics: "metrics-subscription-results",
}


def register_subscriber(
    subscriber_key: str,
) -> Callable[[TQuerySubscriptionCallable], TQuerySubscriptionCallable]:
    def inner(func: TQuerySubscriptionCallable) -> TQuerySubscriptionCallable:
        if subscriber_key in subscriber_registry:
            raise Exception("Handler already registered for %s" % subscriber_key)
        subscriber_registry[subscriber_key] = func
        return func

    return inner


def parse_message_value(value: bytes, jsoncodec: JsonCodec) -> SubscriptionUpdate:
    """
    Parses the value received via the Kafka consumer and verifies that it
    matches the expected schema.
    :param value: A json formatted string
    :return: A dict with the parsed message
    """
    with metrics.timer("snuba_query_subscriber.parse_message_value.json_validate_wrapper"):
        try:
            wrapper = cast(SubscriptionResult, jsoncodec.decode(value, validate=True))
        except ValidationError:
            metrics.incr("snuba_query_subscriber.message_wrapper_invalid")
            raise InvalidSchemaError("Message wrapper does not match schema")

    payload: PayloadV3 = wrapper["payload"]
    # XXX: Since we just return the raw dict here, when the payload changes it'll
    # break things. This should convert the payload into a class rather than passing
    # the dict around, but until we get time to refactor we can keep things working
    # here.
    return {
        "entity": payload["entity"],
        "subscription_id": payload["subscription_id"],
        "values": payload["result"],
        "timestamp": parse_date(payload["timestamp"]).replace(tzinfo=pytz.utc),
    }


def handle_message(
    message_value: bytes,
    message_offset: int,
    message_partition: int,
    topic: str,
    dataset: str,
    jsoncodec: JsonCodec,
) -> None:
    """
    Parses the value from Kafka, and if valid passes the payload to the callback defined by the
    subscription. If the subscription has been removed, or no longer has a valid callback then
    just log metrics/errors and continue.
    :param message:
    :return:
    """
    with sentry_sdk.push_scope() as scope:
        try:
            with metrics.timer(
                "snuba_query_subscriber.parse_message_value", tags={"dataset": dataset}
            ):
                contents = parse_message_value(message_value, jsoncodec)
        except InvalidMessageError:
            # If the message is in an invalid format, just log the error
            # and continue
            logger.exception(
                "Subscription update could not be parsed",
                extra={
                    "offset": message_offset,
                    "partition": message_partition,
                    "value": message_value,
                },
            )
            return
        scope.set_tag("query_subscription_id", contents["subscription_id"])

        try:
            with metrics.timer(
                "snuba_query_subscriber.fetch_subscription", tags={"dataset": dataset}
            ):
                subscription: QuerySubscription = QuerySubscription.objects.get_from_cache(
                    subscription_id=contents["subscription_id"]
                )
                if subscription.status != QuerySubscription.Status.ACTIVE.value:
                    metrics.incr("snuba_query_subscriber.subscription_inactive")
                    return
        except QuerySubscription.DoesNotExist:
            metrics.incr(
                "snuba_query_subscriber.subscription_doesnt_exist", tags={"dataset": dataset}
            )
            logger.warning(
                "Received subscription update, but subscription does not exist",
                extra={
                    "offset": message_offset,
                    "partition": message_partition,
                    "value": message_value,
                },
            )
            try:
                if topic in topic_to_dataset:
                    _delete_from_snuba(
                        topic_to_dataset[topic],
                        contents["subscription_id"],
                        EntityKey(contents["entity"]),
                    )
                else:
                    logger.error(
                        "Topic not registered with QuerySubscriptionConsumer, can't remove "
                        "non-existent subscription from Snuba",
                        extra={"topic": topic, "subscription_id": contents["subscription_id"]},
                    )
            except InvalidMessageError as e:
                logger.exception(e)
            except Exception:
                logger.exception("Failed to delete unused subscription from snuba.")
            return

        if subscription.type not in subscriber_registry:
            metrics.incr(
                "snuba_query_subscriber.subscription_type_not_registered", tags={"dataset": dataset}
            )
            logger.error(
                "Received subscription update, but no subscription handler registered",
                extra={
                    "offset": message_offset,
                    "partition": message_partition,
                    "value": message_value,
                },
            )
            return

        sentry_sdk.set_tag("project_id", subscription.project_id)
        sentry_sdk.set_tag("query_subscription_id", contents["subscription_id"])

        callback = subscriber_registry[subscription.type]
        with sentry_sdk.start_span(op="process_message") as span, metrics.timer(
            "snuba_query_subscriber.callback.duration",
            instance=subscription.type,
            tags={"dataset": dataset},
        ):
            span.set_data("payload", contents)
            span.set_data("subscription_dataset", subscription.snuba_query.dataset)
            span.set_data("subscription_query", subscription.snuba_query.query)
            span.set_data("subscription_aggregation", subscription.snuba_query.aggregate)
            span.set_data("subscription_time_window", subscription.snuba_query.time_window)
            span.set_data("subscription_resolution", subscription.snuba_query.resolution)
            span.set_data("message_offset", message_offset)
            span.set_data("message_partition", message_partition)
            span.set_data("message_value", message_value)

            callback(contents, subscription)


class InvalidMessageError(Exception):
    pass


class InvalidSchemaError(InvalidMessageError):
    pass


class QuerySubscriptionStrategyFactory(ProcessingStrategyFactory[KafkaPayload]):
    def __init__(self, topic: str):
        self.topic = topic
        self.dataset = topic_to_dataset[self.topic]
        self.logical_topic = dataset_to_logical_topic[self.dataset]
        self.jsoncodec = JsonCodec(get_schema(self.logical_topic)["schema"])

    def create_with_partitions(
        self,
        commit: Commit,
        partitions: Mapping[Partition, int],
    ) -> ProcessingStrategy[KafkaPayload]:
        def process_message(message: Message[KafkaPayload]) -> None:
            with sentry_sdk.start_transaction(
                op="handle_message",
                name="query_subscription_consumer_process_message",
                sampled=random() <= options.get("subscriptions-query.sample-rate"),
            ), metrics.timer(
                "snuba_query_subscriber.handle_message", tags={"dataset": self.dataset.value}
            ):
                value = message.value
                assert isinstance(value, BrokerValue)
                offset = value.offset
                partition = value.partition.index
                message_value = value.payload.value
                try:
                    handle_message(
                        message_value,
                        offset,
                        partition,
                        self.topic,
                        self.dataset.value,
                        self.jsoncodec,
                    )
                except Exception:
                    # This is a failsafe to make sure that no individual message will block this
                    # consumer. If we see errors occurring here they need to be investigated to
                    # make sure that we're not dropping legitimate messages.
                    logger.exception(
                        "Unexpected error while handling message in QuerySubscriptionStrategy. Skipping message.",
                        extra={
                            "offset": offset,
                            "partition": partition,
                            "value": message_value,
                        },
                    )

        return RunTask(process_message, CommitOffsets(commit))


def get_query_subscription_consumer(
    topic: str,
    group_id: str,
    strict_offset_reset: bool,
    initial_offset_reset: str,
) -> StreamProcessor[KafkaPayload]:
    cluster_name = settings.KAFKA_TOPICS[topic]["cluster"]
    cluster_options = kafka_config.get_kafka_consumer_cluster_options(cluster_name)
    consumer = KafkaConsumer(
        build_kafka_consumer_configuration(
            cluster_options,
            group_id=group_id,
            strict_offset_reset=strict_offset_reset,
            auto_offset_reset=initial_offset_reset,
        )
    )
    metrics_wrapper = MetricsWrapper(metrics.backend, name="query_subscription_consumer")
    configure_metrics(metrics_wrapper)
    return StreamProcessor(
        consumer=consumer,
        topic=Topic(topic),
        processor_factory=QuerySubscriptionStrategyFactory(topic),
        commit_policy=ONCE_PER_SECOND,
    )
