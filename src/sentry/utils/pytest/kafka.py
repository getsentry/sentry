from __future__ import absolute_import

import os

import pytest
import six
from confluent_kafka.admin import AdminClient
from confluent_kafka import Producer
import time
import logging

_log = logging.getLogger(__name__)

MAX_SECONDS_WAITING_FOR_EVENT = 16


@pytest.fixture
def kafka_producer():
    def inner(settings):
        producer = Producer(
            {"bootstrap.servers": settings.KAFKA_CLUSTERS["default"]["common"]["bootstrap.servers"]}
        )
        return producer

    return inner


class _KafkaAdminWrapper:
    def __init__(self, request, settings):
        self.test_name = request.node.name

        kafka_config = {}
        for key, val in six.iteritems(settings.KAFKA_CLUSTERS["default"]["common"]):
            kafka_config[key] = val

        self.admin_client = AdminClient(kafka_config)

    def delete_topic(self, topic_name):
        try:
            futures_dict = self.admin_client.delete_topics([topic_name])
            self._sync_wait_on_result(futures_dict)
        except Exception:  # noqa
            _log.warning("Could not delete topic %s", topic_name)

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
        # Relay is configured to use this topic for all ingest messages. See
        # `templates/config.yml`.
        "ingest-events": None,
        "outcomes": None,
    }

    yield all_consumers

    for consumer_name, consumer in six.iteritems(all_consumers):
        if consumer is not None:
            try:
                # stop the consumer
                consumer.signal_shutdown()
                consumer.run()
            except:  # noqa:
                _log.warning("Failed to cleanup consumer %s", consumer_name)


@pytest.fixture(scope="function")
def session_ingest_consumer(scope_consumers, kafka_admin, task_runner):
    """
    Returns a factory for a session ingest consumer.

    Note/Warning: Once an ingest consumer is created it will be reused by all tests in the session.
    The ingest consumer is created the first time with the provided settings and then reused.
    If you don't want this behaviour DO NOT USE this fixture (create a fixture, similar with this one,
    that returns a new consumer at each invocation rather then reusing it)

    :return: a function factory that creates a consumer at first invocation and returns the cached consumer afterwards.
    """

    def ingest_consumer(settings):
        from sentry.ingest.ingest_consumer import (
            create_batching_kafka_consumer,
            IngestConsumerWorker,
        )

        # Relay is configured to use this topic for all ingest messages. See
        # `templates/config.yml`.
        topic_event_name = "ingest-events"

        if scope_consumers[topic_event_name] is not None:
            # reuse whatever was already created (will ignore the settings)
            return scope_consumers[topic_event_name]

        # first time the consumer is requested, create it using settings
        admin = kafka_admin(settings)
        admin.delete_topic(topic_event_name)

        # simulate the event ingestion task
        group_id = "test-consumer"

        consumer = create_batching_kafka_consumer(
            topic_names=[topic_event_name],
            worker=IngestConsumerWorker(),
            max_batch_size=1,
            max_batch_time=10,
            group_id=group_id,
            auto_offset_reset="earliest",
        )

        scope_consumers[topic_event_name] = consumer

        return consumer

    return ingest_consumer


@pytest.fixture(scope="function")
def wait_for_ingest_consumer(session_ingest_consumer, task_runner):
    """
    Returns a function that can be used to create a wait loop for the ingest consumer

    The ingest consumer will be called in a loop followed by a query to the supplied
    predicate. If the predicate returns a non None value the wait will be ended and
    the waiter will return whatever the predicate returned.
    If the max_time passes the waiter will be terminated and the waiter will return None

    Note: The reason there we return a factory and not directly the waiter is that we
    need to configure the consumer with the test settings (settings are typically available
    in the test) so a test would typically first create the waiter and the use it to wait for
    the required condition:

    waiter = wait_for_ingest_consumer( test_settings_derived_from_the_project_settings)
    result = waiter( my_predicate, SOME_TIMEOUT)
    assert result == expected_result
    """

    def factory(settings, **kwargs):
        consumer = session_ingest_consumer(settings, **kwargs)

        def waiter(exit_predicate, max_time=MAX_SECONDS_WAITING_FOR_EVENT):
            """
            Implements a wait loop for the ingest consumer
            :param exit_predicate:  A Callable[(),Any] that will be called in a loop after each call
                to the KafkaConsumer _run_once()
            :param max_time: maximum time in seconds to wait
            :return: the first non None result returned by the exit predicate or None if the
                max time has expired without the exit predicate returning a non None value
            """

            start_wait = time.time()
            with task_runner():
                while time.time() - start_wait < max_time:
                    consumer._run_once()  # noqa
                    # check if the condition is satisfied
                    val = exit_predicate()
                    if val is not None:
                        return val  # we got what we were waiting for stop looping

            _log.warning(
                "Ingest consumer waiter timed-out after %d seconds", time.time() - start_wait
            )
            return None  # timout without any success

        return waiter

    return factory
