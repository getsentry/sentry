from __future__ import annotations

from collections.abc import Callable, Iterable, Mapping
from typing import IO, TYPE_CHECKING, Any, Protocol, cast

import pytest
import requests
import responses
from django.conf import LazySettings

from sentry.models.eventattachment import PendingEventAttachment
from sentry.services import eventstore
from sentry.testutils.helpers import get_auth_header

if TYPE_CHECKING:
    from sentry.services.eventstore.models import Event
    from sentry.testutils.cases import TestCase

    RequiredBaseclass = TestCase
else:
    RequiredBaseclass = object


class _IngestWaiter(Protocol):
    def __call__[T](
        self, predicate: Callable[[], T | None], timeout: float | None = None
    ) -> T | None: ...


def _get_event(project_id: int, event_id: str) -> Event | None:
    return eventstore.backend.get_event_by_id(
        project_id,
        event_id,
        tenant_ids={"referrer": "relay-test", "organization_id": 123},
        skip_transaction_groupevent=True,
    )


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
    wait_for_ingest_consumer: _IngestWaiter
    get_relay_attachments_url: Any
    get_relay_minidump_url: Any
    get_relay_unreal_url: Any

    def post_and_retrieve_event(
        self, data: object, headers: Mapping[str, str] | None = None
    ) -> Event:
        if headers is None:
            headers = {"x-sentry-auth": self.auth_header, "content-type": "application/json"}
        url = self.get_relay_store_url(self.project.id)
        responses.add_passthru(url)
        resp = requests.post(
            url,
            headers=headers,
            json=data,
        )

        assert resp.ok, resp.json()
        resp_body = resp.json()
        event_id = resp_body["id"]

        event = self.wait_for_ingest_consumer(lambda: _get_event(self.project.id, event_id))
        # check that we found it in Snuba
        assert event is not None
        return event

    def post_and_retrieve_security_report(self, data: object) -> Event:
        url = self.get_relay_security_url(self.project.id, self.projectkey.public_key)
        responses.add_passthru(url)

        event_ids = {
            event.event_id
            for event in eventstore.backend.get_events(
                eventstore.Filter(project_ids=[self.project.id]),
                tenant_ids={"referrer": "relay-test", "organization_id": 123},
            )
        }

        def has_new_event() -> Event | None:
            # Hack: security report endpoint does not return event ID
            events: Iterable[Event] = eventstore.backend.get_events(
                eventstore.Filter(project_ids=[self.project.id]),
                tenant_ids={"referrer": "relay-test", "organization_id": 123},
            )
            for event in events:
                if event.event_id not in event_ids:
                    return event
            return None

        resp = requests.post(url, json=data)

        assert resp.ok

        event = self.wait_for_ingest_consumer(has_new_event)
        # check that we found it in Snuba
        assert event
        return event

    def post_and_try_retrieve_event(
        self, data: object, headers: Mapping[str, str] | None = None
    ) -> Event | None:
        try:
            return self.post_and_retrieve_event(data, headers)
        except AssertionError:
            return None

    def post_and_retrieve_attachment(
        self,
        event_id: str,
        files: Mapping[str, IO[bytes] | tuple[str, IO[bytes]]],
    ) -> None:
        url = self.get_relay_attachments_url(self.project.id, event_id)
        responses.add_passthru(url)

        resp = requests.post(url, files=files, headers={"x-sentry-auth": self.auth_header})

        assert resp.ok

        exists = self.wait_for_ingest_consumer(
            lambda: (
                PendingEventAttachment.objects.filter(
                    project_id=self.project.id, event_id=event_id
                ).exists()
                or None
            )  # must return None to continue waiting
        )

        assert exists

    def post_and_retrieve_minidump(
        self,
        files: Mapping[str, IO[bytes] | tuple[str, IO[bytes]]] | None,
        data: Mapping[str, object] | None,
    ) -> Event:
        url = self.get_relay_minidump_url(self.project.id, self.projectkey.public_key)
        responses.add_passthru(url)

        resp = requests.post(
            url,
            files=dict(files or ()),
            data=dict(data or ()),
        )

        assert resp.ok
        event_id = resp.text.strip().replace("-", "")

        event = self.wait_for_ingest_consumer(lambda: _get_event(self.project.id, event_id))
        # check that we found it in Snuba
        assert event is not None
        return event

    def post_and_retrieve_unreal(self, payload: bytes) -> Event:
        url = self.get_relay_unreal_url(self.project.id, self.projectkey.public_key)
        responses.add_passthru(url)

        resp = requests.post(
            url,
            data=payload,
        )

        assert resp.ok
        event_id = resp.text.strip().replace("-", "")

        event = self.wait_for_ingest_consumer(lambda: _get_event(self.project.id, event_id))
        # check that we found it in Snuba
        assert event is not None
        return event

    @pytest.fixture(autouse=True)
    def relay_setup_fixtures(
        self,
        settings: LazySettings,
        get_relay_store_url: Callable[..., str],
        get_relay_minidump_url: Callable[..., str],
        get_relay_unreal_url: Callable[..., str],
        get_relay_security_url: Callable[..., str],
        get_relay_attachments_url: Callable[..., str],
        wait_for_ingest_consumer: Callable[..., Callable[..., object | None]],
    ) -> None:
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
        self.wait_for_ingest_consumer = cast("_IngestWaiter", wait_for_ingest_consumer(settings))
