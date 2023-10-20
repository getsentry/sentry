from typing import TYPE_CHECKING, Any

import pytest
import requests
import responses

from sentry import eventstore
from sentry.models.eventattachment import EventAttachment
from sentry.testutils.helpers import get_auth_header

if TYPE_CHECKING:
    from sentry.testutils.cases import TestCase

    RequiredBaseclass = TestCase
else:
    RequiredBaseclass = object


class RelayStoreHelper(RequiredBaseclass):
    """
    Tests that post to the store entry point should use this helper class
    (together with RelayStoreHelper) to check the functionality with relay.

    Note that any methods defined on this mixin are very slow. Consider whether
    your test really needs to test the entire ingestion pipeline or whether
    it's fine to call the regular `store_event` or `create_event`.

    """

    get_relay_store_url: Any
    auth_header: Any
    get_relay_security_url: Any
    wait_for_ingest_consumer: Any
    get_relay_attachments_url: Any
    get_relay_minidump_url: Any
    get_relay_unreal_url: Any

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

        assert resp.ok, resp.json()
        resp_body = resp.json()
        event_id = resp_body["id"]

        event = self.wait_for_ingest_consumer(
            lambda: eventstore.backend.get_event_by_id(
                self.project.id,
                event_id,
                tenant_ids={"referrer": "relay-test", "organization_id": 123},
            )
        )
        # check that we found it in Snuba
        assert event is not None
        return event

    def post_and_retrieve_security_report(self, data):
        url = self.get_relay_security_url(self.project.id, self.projectkey.public_key)
        responses.add_passthru(url)

        event_ids = {
            event.event_id
            for event in eventstore.backend.get_events(
                eventstore.Filter(project_ids=[self.project.id]),
                tenant_ids={"referrer": "relay-test", "organization_id": 123},
            )
        }

        def has_new_event():
            # Hack: security report endpoint does not return event ID
            for event in eventstore.backend.get_events(
                eventstore.Filter(project_ids=[self.project.id]),
                tenant_ids={"referrer": "relay-test", "organization_id": 123},
            ):
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
            lambda: eventstore.backend.get_event_by_id(
                self.project.id,
                event_id,
                tenant_ids={"referrer": "relay-test", "organization_id": 123},
            )
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
            lambda: eventstore.backend.get_event_by_id(
                self.project.id,
                event_id,
                tenant_ids={"referrer": "relay-test", "organization_id": 123},
            )
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
            "TEST_USER_AGENT/0.0.0",
            self.projectkey.public_key,
            self.projectkey.secret_key,
            "7",
        )

        self.get_relay_store_url = get_relay_store_url
        self.get_relay_minidump_url = get_relay_minidump_url
        self.get_relay_unreal_url = get_relay_unreal_url
        self.get_relay_security_url = get_relay_security_url
        self.get_relay_attachments_url = get_relay_attachments_url
        self.wait_for_ingest_consumer = wait_for_ingest_consumer(settings)
