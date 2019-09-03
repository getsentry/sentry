from __future__ import absolute_import

import pytest
import os

import six
from confluent_kafka.admin import AdminClient
from confluent_kafka import Producer

_EVENTS_TOPIC_NAME = "test-ingest-events"
_ATTACHMENTS_TOPIC_NAME = "test-ingest-attachments"
_TRANSACTIONS_TOPIC_NAME = "test-ingest-transactions"


def _get_topic_name(base_topic_name, test_name):
    if test_name is None:
        return base_topic_name
    else:
        return "{}--{}".format(_EVENTS_TOPIC_NAME, test_name)


@pytest.fixture
def kafka_settings(request):
    """
    Returns a minimal configuration for setting up kafka conmmunication
    :param options: initial options to be merged
    :return: the altered options
    """
    # The Travis script sets the kafka bootstrap server into system environment variable.

    def inner():
        test_name = request.node.name
        bootstrap_servers = os.environ.get("SENTRY_KAFKA_HOSTS", "127.0.0.1:9092")

        topic_event = _get_topic_name(_EVENTS_TOPIC_NAME, test_name)
        topic_attachments = _get_topic_name(_ATTACHMENTS_TOPIC_NAME, test_name)
        topic_transactions = _get_topic_name(_TRANSACTIONS_TOPIC_NAME, test_name)

        return {
            "KAFKA_CLUSTERS": {"default": {"bootstrap.servers": bootstrap_servers}},
            "KAFKA_INGEST_EVENTS": topic_event,
            "KAFKA_INGEST_ATTACHMENTS": topic_attachments,
            "KAFKA_INGEST_TRANSACTIONS": topic_transactions,
            "KAFKA_TOPICS": {
                topic_event: {"cluster": "default", "topic": topic_event},
                topic_attachments: {"cluster": "default", "topic": topic_attachments},
                topic_transactions: {"cluster": "default", "topic": topic_transactions},
            },
        }

    return inner


@pytest.fixture
def kafka_producer(kafka_settings):
    def inner():
        settings = kafka_settings()

        producer = Producer(
            {"bootstrap.servers": settings["KAFKA_CLUSTERS"]["default"]["bootstrap.servers"]}
        )
        return producer

    return inner


class _KafkaAdminWrapper:
    def __init__(self, request, settings):
        self.test_name = request.node.name

        kafka_config = {}
        for key, val in six.iteritems(settings["KAFKA_CLUSTERS"]["default"]):
            kafka_config[key] = val

        self.admin_client = AdminClient(kafka_config)

    def delete_events_topic(self):
        self._delete_topic(_EVENTS_TOPIC_NAME)

    def _delete_topic(self, base_topic_name):
        topic_name = _get_topic_name(base_topic_name, self.test_name)
        try:
            futures_dict = self.admin_client.delete_topics([topic_name])
            self._sync_wait_on_result(futures_dict)
        except Exception:  # noqa
            pass  # noqa nothing to do (probably there was no topic to start with)

    def _sync_wait_on_result(self, futures_dict):
        """
        Synchronously waits on all futures returned by the admin_client api.
        :param futures_dict: the api returns a dict of futures that can be awaited
        """
        # just wait on all futures returned by the async operations of the admin_client
        for f in futures_dict.values():
            f.result(5)  # wait up to 5 seconds for the admin operation to finish


@pytest.fixture
def kafka_admin(request, kafka_settings):
    """
    A fixture representing a simple wrapper over the admin interface
    :param request: the pytest request
    :return: a Kafka admin wrapper
    """

    def inner():
        return _KafkaAdminWrapper(request, kafka_settings())

    return inner
