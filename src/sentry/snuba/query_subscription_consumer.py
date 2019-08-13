from __future__ import absolute_import
import logging
from json import loads

import jsonschema
from confluent_kafka import Consumer, KafkaException, TopicPartition
from django.conf import settings

from sentry.snuba.json_schemas import SUBSCRIPTION_PAYLOAD_VERSIONS, SUBSCRIPTION_WRAPPER_SCHEMA
from sentry.snuba.models import QuerySubscription
from sentry.utils import metrics

logger = logging.getLogger(__name__)


subscriber_registry = {}


def register_subscriber(subscriber_key):
    def inner(func):
        if subscriber_key in subscriber_registry:
            raise Exception("Handler already registered for %s" % subscriber_key)
        subscriber_registry[subscriber_key] = func
        return func

    return inner


class InvalidMessageError(Exception):
    pass


class InvalidSchemaError(InvalidMessageError):
    pass


class QuerySubscriptionConsumer(object):
    """
    A Kafka consumer that processes query subscription update messages. Each message has
    a related subscription id and the latest values related to the subscribed query.
    These values are passed along to a callback associated with the subscription.
    """

    def __init__(
        self, group_id, topic=None, commit_batch_size=100, initial_offset_reset="earliest"
    ):
        self.group_id = group_id
        if not topic:
            topic = settings.KAFKA_SNUBA_QUERY_SUBSCRIPTIONS
        self.topic = topic
        cluster_name = settings.KAFKA_TOPICS[topic]["cluster"]
        self.bootstrap_servers = settings.KAFKA_CLUSTERS[cluster_name]["bootstrap.servers"]
        self.commit_batch_size = commit_batch_size
        self.initial_offset_reset = initial_offset_reset
        self.offsets = {}
        self.consumer = None

    def run(self):
        logger.debug("Starting snuba query subscriber")
        self.offsets.clear()

        conf = {
            "bootstrap.servers": self.bootstrap_servers,
            "group.id": self.group_id,
            "session.timeout.ms": 6000,
            "auto.offset.reset": self.initial_offset_reset,
            "enable.auto.commit": "false",
            "enable.auto.offset.store": "false",
            "enable.partition.eof": "false",
            "default.topic.config": {"auto.offset.reset": self.initial_offset_reset},
        }

        def on_revoke(consumer, partitions):
            self.commit_offsets()

        self.consumer = Consumer(conf)
        self.consumer.subscribe([self.topic], on_revoke=on_revoke)

        try:
            i = 0
            while True:
                message = self.consumer.poll(0.1)
                if message is None:
                    continue

                error = message.error()
                if error is not None:
                    raise KafkaException(error)

                i = i + 1

                self.handle_message(message)

                # Track latest completed message here, for use in `shutdown` handler.
                self.offsets[message.partition()] = message.offset() + 1

                if i % self.commit_batch_size == 0:
                    logger.debug("Committing offsets")
                    self.commit_offsets()
        except KeyboardInterrupt:
            pass

        self.shutdown()

    def commit_offsets(self):
        if self.offsets and self.consumer:
            to_commit = [
                TopicPartition(self.topic, partition, offset)
                for partition, offset in self.offsets.items()
            ]
            self.consumer.commit(offsets=to_commit)
            self.offsets.clear()

    def shutdown(self):
        logger.debug("Committing offsets and closing consumer")
        self.commit_offsets()
        self.consumer.close()

    def handle_message(self, message):
        """
        Parses the value from Kafka, and if valid passes the payload to the callback defined by the
        subscription. If the subscription has been removed, or no longer has a valid callback then
        just log metrics/errors and continue.
        :param message:
        :return:
        """
        try:
            contents = self.parse_message_value(message.value())
        except InvalidMessageError:
            # If the message is in an invalid format, just log the error
            # and continue
            logger.exception(
                "Subscription update could not be parsed",
                extra={
                    "offset": message.offset(),
                    "partition": message.partition(),
                    "value": message.value(),
                },
            )
            return

        try:
            subscription = QuerySubscription.objects.get(
                subscription_id=contents["subscription_id"]
            )
        except QuerySubscription.DoesNotExist:
            metrics.incr("snuba_query_subscriber.subscription_doesnt_exist")
            logger.error(
                "Received subscription update, but subscription does not exist",
                extra={
                    "offset": message.offset(),
                    "partition": message.partition(),
                    "value": message.value(),
                },
            )
            return

        if subscription.type not in subscriber_registry:
            metrics.incr("snuba_query_subscriber.subscription_type_not_registered")
            logger.error(
                "Received subscription update, but no subscription handler registered",
                extra={
                    "offset": message.offset(),
                    "partition": message.partition(),
                    "value": message.value(),
                },
            )
            return

        callback = subscriber_registry[subscription.type]
        with metrics.timer("snuba_query_subscriber.callback.duration", instance=subscription.type):
            callback(contents, subscription)

    def parse_message_value(self, value):
        """
        Parses the value received via the Kafka consumer and verifies that it
        matches the expected schema.
        :param value: A json formatted string
        :return: A dict with the parsed message
        """
        wrapper = loads(value)
        try:
            jsonschema.validate(wrapper, SUBSCRIPTION_WRAPPER_SCHEMA)
        except jsonschema.ValidationError:
            metrics.incr("snuba_query_subscriber.message_wrapper_invalid")
            raise InvalidSchemaError("Message wrapper does not match schema")

        schema_version = wrapper["version"]
        if schema_version not in SUBSCRIPTION_PAYLOAD_VERSIONS:
            metrics.incr("snuba_query_subscriber.message_wrapper_invalid_version")
            raise InvalidMessageError("Version specified in wrapper has no schema")

        payload = wrapper["payload"]
        try:
            jsonschema.validate(payload, SUBSCRIPTION_PAYLOAD_VERSIONS[schema_version])
        except jsonschema.ValidationError:
            metrics.incr("snuba_query_subscriber.message_payload_invalid")
            raise InvalidSchemaError("Message payload does not match schema")

        return payload
