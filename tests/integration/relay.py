# -*- coding: utf-8 -*-

from __future__ import absolute_import, print_function

import datetime
from sentry import eventstore
import pytest
import requests

from sentry.testutils import TransactionTestCase
from sentry.testutils.helpers import get_auth_header
from sentry.ingest.ingest_consumer import ConsumerType, get_ingest_consumer

# Poll this amount of times (for 0.1 sec each) at most to wait for messages
MAX_POLL_ITERATIONS = 100


# @requires_snuba
@pytest.mark.django_db
@pytest.mark.skip("Not ready yet")
class RelayIntegrationTest(TransactionTestCase):
    def setUp(self):
        self.user = self.create_user("coreapi@example.com")
        self.organization = self.create_organization()
        self.project = self.create_project(organization=self.organization)
        self.pk = self.project.key_set.get_or_create()[0]

    @pytest.fixture(autouse=True)
    def setup_fixtures(self, settings, live_server, relay_server, task_runner, kafka_admin):
        """
            Used to inject the sentry server (live_server) and
            the relay_server in the test class.
            Called by pytest as an autofixture.
        """
        settings.ALLOWED_HOSTS = ["localhost", "testserver", "host.docker.internal"]
        self.live_server = live_server
        self.relay_server = relay_server
        self.kafka_admin = kafka_admin
        self.task_runner = task_runner
        self.settings = settings

    def test_simple(self):

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
            max_batch_time=5000,
            group_id=group_id,
            consumer_type=ConsumerType.Events,
            auto_offset_reset="earliest",
        )

        # run the ingest consumer and consume the kafka events coming from relay
        event = None
        with self.task_runner():
            i = 0
            while i < MAX_POLL_ITERATIONS:
                consumer._run_once()
                # check event has reached snuba
                event = eventstore.get_event_by_id(self.project.id, event_id)
                if event is not None:
                    break
                i += 1

        # Found the event in snuba
        assert event is not None

        # check that the message ended up in snuba
