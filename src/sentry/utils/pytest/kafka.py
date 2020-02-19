from __future__ import absolute_import

import os

import pytest
import six
from confluent_kafka.admin import AdminClient
from confluent_kafka import Producer


@pytest.fixture
def kafka_producer():
    def inner(settings):
        producer = Producer(
            {"bootstrap.servers": settings.KAFKA_CLUSTERS["default"]["bootstrap.servers"]}
        )
        return producer

    return inner


class _KafkaAdminWrapper:
    def __init__(self, request, settings):
        self.test_name = request.node.name

        kafka_config = {}
        for key, val in six.iteritems(settings.KAFKA_CLUSTERS["default"]):
            kafka_config[key] = val

        self.admin_client = AdminClient(kafka_config)

    def delete_topic(self, topic_name):
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
def kafka_admin(request):
    """
    A fixture representing a simple wrapper over the admin interface
    :param request: the pytest request
    :return: a Kafka admin wrapper
    """

    def inner(settings):
        return _KafkaAdminWrapper(request, settings)

    return inner


@pytest.fixture
def kafka_topics_setter():
    """
    Returns a function that given a Django settings objects will setup the
    kafka topics names to test names.

    :return: a function that given a settings object changes all kafka topic names
    to "test-<normal_topic_name>"
    """

    def set_test_kafka_settings(settings):
        ingest_events = "ingest-events"
        settings.KAFKA_INGEST_EVENTS = ingest_events
        settings.KAFKA_TOPICS[ingest_events] = {"cluster": "default", "topic": ingest_events}

        ingest_transactions = "ingest-transactions"
        settings.INGEST_TRANSACTIONS = ingest_transactions
        settings.KAFKA_TOPICS[ingest_transactions] = {
            "cluster": "default",
            "topic": ingest_transactions,
        }

        ingest_attachments = "ingest-attachments"
        settings.KAFKA_INGEST_ATTACHMENTS = ingest_attachments
        settings.KAFKA_TOPICS[ingest_attachments] = {
            "cluster": "default",
            "topic": ingest_attachments,
        }

        outcomes = "outcomes"
        settings.KAFKA_OUTCOMES = outcomes
        settings.KAFKA_TOPICS[outcomes] = {"cluster": "default", "topic": outcomes}

    return set_test_kafka_settings


@pytest.fixture
def requires_kafka():
    pytest.importorskip("confluent_kafka")

    if "SENTRY_KAFKA_HOSTS" not in os.environ:
        pytest.xfail("test requires SENTRY_KAFKA_HOSTS environment variable which is not set")


@pytest.fixture(scope="session")
def scope_consumers():
    """
      Sets up an object to keep track of the scope consumers ( consumers that will only
      be created once per test session).

    """
    all_consumers = {
        "ingest_events": None,
        "ingest_transactions": None,
        "ingest_attachments": None,
        "outcomes": None,
    }
    yield all_consumers

    for consumer in (all_consumers.get(consumer_name) for consumer_name in ("ingest_events",
                                                                            "ingest_transactions",
                                                                            "ingest_attachments",
                                                                            "outcomes")):
        if consumer is not None:
            try:
                # stop the consumer
                consumer.signal_shutdown()
                consumer.run()
            except:  # noqa:
                pass # we tried a clean shutdown, nothing we can do about the error


@pytest.fixture(scope="function")
def session_ingest_consumer(scope_consumers, kafka_admin):
    def ingest_consumer(settings):
        from sentry.ingest.ingest_consumer import ConsumerType, get_ingest_consumer

        if scope_consumers["ingest_events"] is not None:
            return scope_consumers["ingest_events"]  # reuse whatever was already created (will ignore the settings)

        # first time the consumer is requested, create it using settings
        topic_event_name = ConsumerType.get_topic_name(ConsumerType.Events)
        admin = kafka_admin(settings)
        admin.delete_topic(topic_event_name)

        # simulate the event ingestion task
        group_id = "test-consumer"

        consumer = get_ingest_consumer(
            max_batch_size=1,
            max_batch_time=10,
            group_id=group_id,
            consumer_type=ConsumerType.Events,
            auto_offset_reset="earliest",
        )

        scope_consumers["ingest_events"] = consumer

        return consumer

    return ingest_consumer
