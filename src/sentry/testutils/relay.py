import pytest
import requests
import responses

from sentry import eventstore
from sentry.eventtypes import transaction
from sentry.models import EventAttachment, Relay
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


class RelayStoreHelper:
    """
    Tests that post to the store entry point should use this helper class
    (together with RelayStoreHelper) to check the functionality with relay.

    Note that any methods defined on this mixin are very slow. Consider whether
    your test really needs to test the entire ingestion pipeline or whether
    it's fine to call the regular `store_event` or `create_event`.
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

    def post_and_retrieve_security_report(self, data):
        url = self.get_relay_security_url(self.project.id, self.projectkey.public_key)
        responses.add_passthru(url)

        event_ids = {
            event.event_id
            for event in eventstore.get_events(eventstore.Filter(project_ids=[self.project.id]))
        }

        def has_new_event():
            # Hack: security report endpoint does not return event ID
            for event in eventstore.get_events(eventstore.Filter(project_ids=[self.project.id])):
                if event.event_id not in event_ids:
                    return event

        resp = requests.post(url, json=data)

        assert resp.ok

        event = self.wait_for_ingest_consumer(has_new_event)
        # check that we found it in Snuba
        assert event
        return event

    def post_and_try_retrieve_event(self, data):
        try:
            return self.post_and_retrieve_event(data)
        except AssertionError:
            return None

    def post_and_retrieve_attachment(self, event_id, files):
        url = self.get_relay_attachments_url(self.project.id, event_id)
        responses.add_passthru(url)

        resp = requests.post(url, files=files, headers={"x-sentry-auth": self.auth_header})

        assert resp.ok

        exists = self.wait_for_ingest_consumer(
            lambda: EventAttachment.objects.filter(
                project_id=self.project.id, event_id=event_id
            ).exists()
            or None  # must return None to continue waiting
        )

        assert exists

    def post_and_retrieve_minidump(self, files, data):
        url = self.get_relay_minidump_url(self.project.id, self.projectkey.public_key)
        responses.add_passthru(url)

        resp = requests.post(
            url,
            files=dict(files or ()),
            data=dict(data or ()),
        )

        assert resp.ok
        event_id = resp.text.strip().replace("-", "")

        event = self.wait_for_ingest_consumer(
            lambda: eventstore.get_event_by_id(self.project.id, event_id)
        )
        # check that we found it in Snuba
        assert event is not None
        return event

    def post_and_retrieve_unreal(self, payload):
        url = self.get_relay_unreal_url(self.project.id, self.projectkey.public_key)
        responses.add_passthru(url)

        resp = requests.post(
            url,
            data=payload,
        )

        assert resp.ok
        event_id = resp.text.strip().replace("-", "")

        event = self.wait_for_ingest_consumer(
            lambda: eventstore.get_event_by_id(self.project.id, event_id)
        )
        # check that we found it in Snuba
        assert event is not None
        return event

    @pytest.fixture(autouse=True)
    def relay_setup_fixtures(
        self,
        settings,
        live_server,
        get_relay_store_url,
        get_relay_minidump_url,
        get_relay_unreal_url,
        get_relay_security_url,
        get_relay_attachments_url,
        wait_for_ingest_consumer,
    ):
        self.auth_header = get_auth_header(
            "TEST_USER_AGENT/0.0.0", self.projectkey.public_key, self.projectkey.secret_key, "7"
        )

        self.settings = settings
        self.get_relay_store_url = get_relay_store_url  # noqa
        self.get_relay_minidump_url = get_relay_minidump_url  # noqa
        self.get_relay_unreal_url = get_relay_unreal_url  # noqa
        self.get_relay_security_url = get_relay_security_url  # noqa
        self.get_relay_attachments_url = get_relay_attachments_url  # noqa
        self.wait_for_ingest_consumer = wait_for_ingest_consumer(settings)  # noqa
