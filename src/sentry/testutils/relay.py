from __future__ import absolute_import

import json

import pytest
import requests
import responses

from sentry import eventstore
from sentry.eventtypes import transaction
from sentry.models.relay import Relay
from sentry.testutils.helpers import get_auth_header


def ensure_relay_is_registered():
    """
    Ensure that the test Relay instance is registered

    Note: This is an ugly hack, we need it because we are persisting a Relay instance during the whole
    test session and the database is cleaned up after each test.
    Relay will do a security handshake when it is started and this will result in a Relay object
    being added in the database. After the test is finished the entry will be cleaned up and next
    time Relay will be used in another test it will not be recognized as an internal relay.

    TODO: A fix for this would be to restart Relay for every test I (RaduW) need to investigate the
    performance hit for starting relay for every test that uses it.
    """
    try:
        with transaction.atomic():
            # just check for the Relay object and insert it if it does not exist
            Relay.objects.create(
                relay_id="88888888-4444-4444-8444-cccccccccccc",
                public_key="SMSesqan65THCV6M4qs4kBzPai60LzuDn-xNsvYpuP8",
                is_internal=True,
            )
    except:  # NOQA
        # relay already registered  probably the first test (registration happened at Relay handshake time)
        pass  # NOQA


def adjust_settings_for_relay_tests(settings):
    """
    Adjusts the application settings to accept calls from a Relay instance running inside a
    docker container.

    :param settings: the app settings
    """
    settings.ALLOWED_HOSTS = [
        "localhost",
        "testserver",
        "host.docker.internal",
        "0.0.0.0",
        "127.0.0.1",
    ]
    settings.KAFKA_CLUSTERS = {
        "default": {
            "bootstrap.servers": "127.0.0.1:9092",
            "compression.type": "lz4",
            "message.max.bytes": 50000000,  # 50MB, default is 1MB
        }
    }
    settings.SENTRY_RELAY_WHITELIST_PK = ["SMSesqan65THCV6M4qs4kBzPai60LzuDn-xNsvYpuP8"]


class SentryStoreHelper(object):
    """
    Unit tests that post to the store entry point should use this
    helper class (together with RelayStoreHelper) to check the functionality
    with both posting to the Sentry Store and the Relay Store.
    """

    def use_relay(self):
        return False

    def post_and_retrieve_event(self, data):
        resp = self._postWithHeader(data)
        assert resp.status_code == 200
        event_id = json.loads(resp.content)["id"]

        event = eventstore.get_event_by_id(self.project.id, event_id)
        assert event is not None
        return event


class RelayStoreHelper(object):
    """
    Unit tests that post to the store entry point should use this
    helper class (together with RelayStoreHelper) to check the functionality
    with both posting to the Sentry Store and the Relay Store.
    """

    def use_relay(self):
        return True

    def post_and_retrieve_event(self, data):
        url = self.get_relay_store_url(self.project.id)
        responses.add_passthru(url)
        resp = requests.post(
            url,
            headers={"x-sentry-auth": self.auth_header, "content-type": "application/json"},
            json=data,
        )

        assert resp.ok
        resp_body = resp.json()
        event_id = resp_body["id"]

        event = self.wait_for_ingest_consumer(
            lambda: eventstore.get_event_by_id(self.project.id, event_id)
        )
        # check that we found it in Snuba
        assert event is not None
        return event

    def post_and_try_retrieve_event(self, data):
        try:
            return self.post_and_retrieve_event(data)
        except AssertionError:
            return None

    def setUp(self):  # NOQA
        self.auth_header = get_auth_header(
            "TEST_USER_AGENT/0.0.0", self.projectkey.public_key, self.projectkey.secret_key, "7"
        )
        adjust_settings_for_relay_tests(self.settings)

    @pytest.fixture(autouse=True)
    def setup_fixtures(self, settings, live_server, get_relay_store_url, wait_for_ingest_consumer):
        self.settings = settings
        self.get_relay_store_url = get_relay_store_url  # noqa
        self.wait_for_ingest_consumer = wait_for_ingest_consumer(settings)  # noqa
