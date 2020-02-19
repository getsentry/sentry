# -*- coding: utf-8 -*-

from __future__ import absolute_import, print_function

import datetime

from django.db import IntegrityError

from sentry import eventstore
import pytest
import requests

from sentry.testutils import TransactionTestCase, TestCase
from sentry.testutils.fixtures import Fixtures
from sentry.testutils.helpers import get_auth_header
from sentry.ingest.ingest_consumer import ConsumerType, get_ingest_consumer

from sentry.models import Relay

# Poll this amount of times (for 0.1 sec each) at most to wait for messages
MAX_POLL_ITERATIONS = 15


class RelayIntegrationTest(TransactionTestCase):
    def setUp(self):
        self.user = self.create_user("coreapi@example.com")
        self.organization = self.create_organization(owner=self.user)
        self.project = self.create_project(organization=self.organization)
        self.pk = self.project.key_set.get_or_create()[0]

        try:
            Relay.objects.create(
                relay_id="88888888-4444-4444-8444-cccccccccccc",
                public_key="SMSesqan65THCV6M4qs4kBzPai60LzuDn-xNsvYpuP8",
                is_internal=True
            )
        except:
            pass

    @pytest.fixture(autouse=True)
    def setup_fixtures(self, settings, live_server, relay_server, task_runner, kafka_admin,
                       session_ingest_consumer):
        """
            Used to inject the sentry server (live_server) and
            the relay_server in the test class.
            Called by pytest as an autofixture.
        """
        settings.ALLOWED_HOSTS = ["localhost", "testserver", "host.docker.internal"]
        settings.KAFKA_CLUSTERS = {
            "default": {
                "bootstrap.servers": "127.0.0.1:9092",
                "compression.type": "lz4",
                "message.max.bytes": 50000000,  # 50MB, default is 1MB
            }
        }

        # settings)
        self.live_server = live_server
        self.relay_server = relay_server
        self.kafka_admin = kafka_admin
        self.task_runner = task_runner
        self.settings = settings
        # self.session_ingest_consumer = session_ingest_consumer

    # def test_1(self):
    #     self._t_body()
    #
    # def test_2(self):
    #     self._t_body()
    #
    # def test_3(self):
    #     self._t_body()
    #
    # def test_4(self):
    #     self._t_body()
    #
    # def test_5(self):
    #     self._t_body()
    #
    # def test_6(self):
    #     self._t_body()
    #
    # def test_7(self):
    #     self._t_body()
    #
    # def test_8(self):
    #     self._t_body()
    #
    # def test_9(self):
    #     self._t_body()
    #
    # def test_10(self):
    #     self._t_body()

    def _t_body(self):

        topic_event_name = ConsumerType.get_topic_name(ConsumerType.Events)
        admin = self.kafka_admin(self.settings)
        admin.delete_topic(topic_event_name)

        auth = get_auth_header(
            "TEST_USER_AGENT/0.0.0", self.projectkey.public_key, self.projectkey.secret_key, "7"
        )

        url = "{}/api/{}/store/".format(self.relay_server["url"], self.pk.project_id)

        timestamp = datetime.datetime.now().strftime("%Y-%m-%d_%H-%M-%S_%f")
        message = "test_simple_{}".format(timestamp)
        data = '{{"message": "{}", "extra": "{}"}}'.format(message, timestamp)
        # send request to relay
        response = requests.post(
            url,
            headers={"x-sentry-auth": auth, "content-type": "application/json"},
            data=bytes(data),
        )
        assert response.ok
        resp_body = response.json()
        event_id = resp_body["id"]

        # simulate the event ingestion task
        group_id = "test-consumer"

        consumer = get_ingest_consumer(
            max_batch_size=2,
            max_batch_time=10,
            group_id=group_id,
            consumer_type=ConsumerType.Events,
            auto_offset_reset="earliest",
        )
        # consumer = self.session_ingest_consumer(self.settings)

        # run the ingest consumer and consume the kafka events coming from relay
        event = None
        with self.task_runner():
            i = 0
            while i < MAX_POLL_ITERATIONS:
                consumer._run_once()
                # check event has reached snuba
                event = eventstore.get_event_by_id(self.project.id, event_id)
                if event is not None:
                    del event
                    break
                i += 1

        # stop the consumer
        # consumer.signal_shutdown()
        # consumer.run()

        # Found the event in snuba
        assert event is not None


def test_1(settings, live_server, relay_server, task_runner, kafka_admin,
           session_ingest_consumer, default_project, default_projectkey):
    t_relay(settings, relay_server, task_runner, kafka_admin, session_ingest_consumer, default_project,
            default_projectkey)


def test_2(settings, live_server, relay_server, task_runner, kafka_admin,
           session_ingest_consumer, default_project, default_projectkey):
    t_relay(settings, relay_server, task_runner, kafka_admin, session_ingest_consumer, default_project,
            default_projectkey)


def test_3(settings, live_server, relay_server, task_runner, kafka_admin,
           session_ingest_consumer, default_project, default_projectkey):
    t_relay(settings, relay_server, task_runner, kafka_admin, session_ingest_consumer, default_project,
            default_projectkey)


def test_4(settings, live_server, relay_server, task_runner, kafka_admin,
           session_ingest_consumer, default_project, default_projectkey):
    t_relay(settings, relay_server, task_runner, kafka_admin, session_ingest_consumer, default_project,
            default_projectkey)


def test_5(settings, live_server, relay_server, task_runner, kafka_admin,
           session_ingest_consumer, default_project, default_projectkey):
    t_relay(settings, relay_server, task_runner, kafka_admin, session_ingest_consumer, default_project,
            default_projectkey)


def test_6(settings, live_server, relay_server, task_runner, kafka_admin,
           session_ingest_consumer, default_project, default_projectkey):
    t_relay(settings, relay_server, task_runner, kafka_admin, session_ingest_consumer, default_project,
            default_projectkey)


def test_7(settings, live_server, relay_server, task_runner, kafka_admin,
           session_ingest_consumer, default_project, default_projectkey):
    t_relay(settings, relay_server, task_runner, kafka_admin, session_ingest_consumer, default_project,
            default_projectkey)


def test_8(settings, live_server, relay_server, task_runner, kafka_admin,
           session_ingest_consumer, default_project, default_projectkey):
    t_relay(settings, relay_server, task_runner, kafka_admin, session_ingest_consumer, default_project,
            default_projectkey)


def test_9(settings, live_server, relay_server, task_runner, kafka_admin,
           session_ingest_consumer, default_project, default_projectkey):
    t_relay(settings, relay_server, task_runner, kafka_admin, session_ingest_consumer, default_project,
            default_projectkey)


def test_10(settings, live_server, relay_server, task_runner, kafka_admin,
            session_ingest_consumer, default_project, default_projectkey):
    t_relay(settings, relay_server, task_runner, kafka_admin, session_ingest_consumer, default_project,
            default_projectkey)


def test_1_1(settings, live_server, relay_server, task_runner, kafka_admin,
             session_ingest_consumer, default_project, default_projectkey):
    t_relay(settings, relay_server, task_runner, kafka_admin, session_ingest_consumer, default_project,
            default_projectkey)


def test_2_1(settings, live_server, relay_server, task_runner, kafka_admin,
             session_ingest_consumer, default_project, default_projectkey):
    t_relay(settings, relay_server, task_runner, kafka_admin, session_ingest_consumer, default_project,
            default_projectkey)


def test_3_1(settings, live_server, relay_server, task_runner, kafka_admin,
             session_ingest_consumer, default_project, default_projectkey):
    t_relay(settings, relay_server, task_runner, kafka_admin, session_ingest_consumer, default_project,
            default_projectkey)


def test_4_1(settings, live_server, relay_server, task_runner, kafka_admin,
             session_ingest_consumer, default_project, default_projectkey):
    t_relay(settings, relay_server, task_runner, kafka_admin, session_ingest_consumer, default_project,
            default_projectkey)


def test_5_1(settings, live_server, relay_server, task_runner, kafka_admin,
             session_ingest_consumer, default_project, default_projectkey):
    t_relay(settings, relay_server, task_runner, kafka_admin, session_ingest_consumer, default_project,
            default_projectkey)


def test_6_1(settings, live_server, relay_server, task_runner, kafka_admin,
             session_ingest_consumer, default_project, default_projectkey):
    t_relay(settings, relay_server, task_runner, kafka_admin, session_ingest_consumer, default_project,
            default_projectkey)


def test_7_1(settings, live_server, relay_server, task_runner, kafka_admin,
             session_ingest_consumer, default_project, default_projectkey):
    t_relay(settings, relay_server, task_runner, kafka_admin, session_ingest_consumer, default_project,
            default_projectkey)


def test_8_1(settings, live_server, relay_server, task_runner, kafka_admin,
             session_ingest_consumer, default_project, default_projectkey):
    t_relay(settings, relay_server, task_runner, kafka_admin, session_ingest_consumer, default_project,
            default_projectkey)


def test_9_1(settings, live_server, relay_server, task_runner, kafka_admin,
             session_ingest_consumer, default_project, default_projectkey):
    t_relay(settings, relay_server, task_runner, kafka_admin, session_ingest_consumer, default_project,
            default_projectkey)


def test_10_1(settings, live_server, relay_server, task_runner, kafka_admin,
              session_ingest_consumer, default_project, default_projectkey):
    t_relay(settings, relay_server, task_runner, kafka_admin, session_ingest_consumer, default_project,
            default_projectkey)


def t_relay(settings, relay_server, task_runner, kafka_admin, session_ingest_consumer, default_project,
            default_projectkey):
    settings.ALLOWED_HOSTS = ["localhost", "testserver", "host.docker.internal"]
    settings.KAFKA_CLUSTERS = {
        "default": {
            "bootstrap.servers": "127.0.0.1:9092",
            "compression.type": "lz4",
            "message.max.bytes": 50000000,  # 50MB, default is 1MB
        }

    }
    project = default_project
    projectkey = default_projectkey

    try:
        Relay.objects.create(
            relay_id="88888888-4444-4444-8444-cccccccccccc", public_key="SMSesqan65THCV6M4qs4kBzPai60LzuDn-xNsvYpuP8",
            is_internal=True
        )
    except IntegrityError:
        #  this should happen for the first test that runs after relay registers with upstream (i.e. first test using
        #  relay)
        pass


    auth = get_auth_header(
        "TEST_USER_AGENT/0.0.0", projectkey.public_key, projectkey.secret_key, "7"
    )

    url = "{}/api/{}/store/".format(relay_server["url"], projectkey.project_id)

    timestamp = datetime.datetime.now().strftime("%Y-%m-%d_%H-%M-%S_%f")
    message = "test_simple_{}".format(timestamp)
    data = '{{"message": "{}", "extra": "{}"}}'.format(message, timestamp)
    # send request to relay
    response = requests.post(
        url,
        headers={"x-sentry-auth": auth, "content-type": "application/json"},
        data=bytes(data),
    )

    assert response.ok
    resp_body = response.json()
    event_id = resp_body["id"]

    # simulate the event ingestion task
    # topic_event_name = ConsumerType.get_topic_name(ConsumerType.Events)
    # admin = kafka_admin(settings)
    # admin.delete_topic(topic_event_name)

    # group_id = "test-consumer"

    # consumer = get_ingest_consumer(
    #     max_batch_size=2,
    #     max_batch_time=10,
    #     group_id=group_id,
    #     consumer_type=ConsumerType.Events,
    #     auto_offset_reset="earliest",
    # )
    consumer = session_ingest_consumer(settings)

    # run the ingest consumer and consume the kafka events coming from relay
    event = None
    with task_runner():
        i = 0
        while i < MAX_POLL_ITERATIONS:
            consumer._run_once()
            # check event has reached snuba
            event = eventstore.get_event_by_id(project.id, event_id)
            if event is not None:
                break
            i += 1

    # stop the consumer
    # consumer.signal_shutdown()
    # consumer.run()

    # Found the event in snuba
    assert event is not None
