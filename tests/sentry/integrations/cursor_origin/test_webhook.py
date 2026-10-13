from __future__ import annotations

import hashlib
import time
from base64 import b64encode
from typing import Any
from unittest import mock

import orjson
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

from sentry.constants import ObjectStatus
from sentry.integrations.cursor_origin.keys import OriginSigningKey
from sentry.integrations.cursor_origin.webhook import has_already_processed
from sentry.integrations.models.integration import Integration
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import cell_silo_test, control_silo_test

KEYS = "sentry.integrations.cursor_origin.webhook.signing_keys_for"
APP_ID = "app_01example"
DELIVERY_ID = "whd_01example"
INSTALLATION_ID = "i_01example"


def _envelope(
    app_id: str = APP_ID,
    event_type: str = "installation.deleted",
    installation_id: str | None = INSTALLATION_ID,
) -> bytes:
    envelope: dict[str, Any] = {
        "deliveryId": DELIVERY_ID,
        "appId": app_id,
        "event": {
            "id": "evt_01example",
            "type": event_type,
            "eventTime": "2026-09-16T10:03:00Z",
            "payload": {"installation": {"id": installation_id}},
        },
    }
    if installation_id is not None:
        envelope["installationId"] = installation_id
    return orjson.dumps(envelope)


BODY = _envelope()


def _signing_key() -> tuple[Ed25519PrivateKey, OriginSigningKey]:
    private = Ed25519PrivateKey.generate()
    raw = private.public_key().public_bytes(
        encoding=serialization.Encoding.Raw, format=serialization.PublicFormat.Raw
    )
    return private, OriginSigningKey(kid="origin-key-1", public_key=raw)


def _signature(private: Ed25519PrivateKey, delivery_id: str, timestamp: str, body: bytes) -> str:
    digest = hashlib.sha256(b".".join([delivery_id.encode(), timestamp.encode(), body])).hexdigest()
    return "v1ed," + b64encode(private.sign(digest.encode("utf-8"))).decode()


@control_silo_test
class CursorOriginWebhookTest(APITestCase):
    def setUp(self) -> None:
        super().setUp()
        self.url = "/extensions/cursor_origin/webhook/"
        self.private, self.public = _signing_key()

    def _post(
        self,
        body: bytes = BODY,
        timestamp: str | None = None,
        signature: str | None = None,
        event_type: str = "installation.deleted",
        keys: list[OriginSigningKey] | None = None,
    ) -> int:
        timestamp = timestamp if timestamp is not None else str(int(time.time()))
        if signature is None:
            signature = _signature(self.private, DELIVERY_ID, timestamp, body)

        with (
            self.options({"cursor-origin-app.id": APP_ID}),
            mock.patch(KEYS, return_value=[self.public] if keys is None else keys),
        ):
            response = self.client.post(
                path=self.url,
                data=body,
                content_type="application/json",
                headers={
                    "webhook-id": DELIVERY_ID,
                    "webhook-timestamp": timestamp,
                    "webhook-signature": signature,
                    "webhook-event-type": event_type,
                },
            )
        return response.status_code

    def test_an_uninstall_disables_the_integration(self) -> None:
        integration = self.create_integration(
            organization=self.organization,
            provider="cursor_origin",
            name="acme",
            external_id=INSTALLATION_ID,
        )

        assert self._post(body=_envelope(event_type="installation.deleted")) == 204

        assert Integration.objects.get(id=integration.id).status == ObjectStatus.DISABLED

    def test_a_failed_handler_leaves_the_delivery_for_the_retry(self) -> None:
        self.create_integration(
            organization=self.organization,
            provider="cursor_origin",
            name="acme",
            external_id=INSTALLATION_ID,
        )

        with mock.patch(
            "sentry.integrations.cursor_origin.handlers.integration_service.update_integration",
            side_effect=ValueError("boom"),
        ):
            assert self._post(body=_envelope(event_type="installation.deleted")) == 500

        assert not has_already_processed(DELIVERY_ID)

    def test_a_failed_installation_lookup_leaves_the_delivery_for_the_retry(self) -> None:
        """The lookup is an RPC, so a control-silo failure must not claim the delivery."""
        with mock.patch(
            "sentry.integrations.cursor_origin.webhook.integration_service.organization_contexts",
            side_effect=ValueError("boom"),
        ):
            assert self._post(body=_envelope(event_type="installation.deleted")) == 500

        assert not has_already_processed(DELIVERY_ID)

    def test_a_delivery_for_an_installation_sentry_does_not_have_is_accepted(self) -> None:
        """A half-finished install, or one already removed from this side."""
        integration = self.create_integration(
            organization=self.organization,
            provider="cursor_origin",
            name="acme",
            external_id=INSTALLATION_ID,
        )

        assert self._post(body=_envelope(installation_id="i_01someone_else")) == 204

        assert Integration.objects.get(id=integration.id).status == ObjectStatus.ACTIVE

    def test_a_delivery_with_no_installation_is_accepted(self) -> None:
        """Origin marks `installationId` required, so a missing one is theirs to fix."""
        integration = self.create_integration(
            organization=self.organization,
            provider="cursor_origin",
            name="acme",
            external_id=INSTALLATION_ID,
        )

        assert self._post(body=_envelope(installation_id=None)) == 204

        assert Integration.objects.get(id=integration.id).status == ObjectStatus.ACTIVE

    def test_get_is_not_allowed(self) -> None:
        assert self.client.get(self.url).status_code == 405

    def test_a_signed_delivery_is_accepted(self) -> None:
        assert self._post() == 204

    def test_an_event_without_a_handler_is_accepted(self) -> None:
        """Origin delivers every installation event whether we act on it or not."""
        body = _envelope(event_type="pull_request.created")
        assert self._post(body=body, event_type="installation.updated") == 204

    def test_a_delivery_with_no_signature_is_refused(self) -> None:
        response = self.client.post(path=self.url, data=BODY, content_type="application/json")

        assert response.status_code == 401

    def test_a_signature_alongside_another_scheme_is_found(self) -> None:
        """The header carries one signature per key, so ours may not come first."""
        timestamp = str(int(time.time()))
        ours = _signature(self.private, DELIVERY_ID, timestamp, BODY)

        assert self._post(timestamp=timestamp, signature=f"v1,not-ours {ours}") == 204

    def test_a_signature_from_a_rotated_key_is_accepted(self) -> None:
        retired, _ = _signing_key()
        timestamp = str(int(time.time()))
        old = _signature(retired, DELIVERY_ID, timestamp, BODY)
        new = _signature(self.private, DELIVERY_ID, timestamp, BODY)

        assert self._post(timestamp=timestamp, signature=f"{old} {new}") == 204

    def test_a_forged_signature_is_refused(self) -> None:
        other, _ = _signing_key()
        timestamp = str(int(time.time()))

        assert self._post(signature=_signature(other, DELIVERY_ID, timestamp, BODY)) == 401

    def test_a_signature_over_another_body_is_refused(self) -> None:
        timestamp = str(int(time.time()))
        signature = _signature(self.private, DELIVERY_ID, timestamp, b'{"payload":{}}')

        assert self._post(timestamp=timestamp, signature=signature) == 401

    def test_a_replayed_delivery_is_refused_once_it_is_stale(self) -> None:
        """Origin asks receivers to refuse a timestamp more than five minutes out."""
        stale = str(int(time.time()) - 600)

        assert self._post(timestamp=stale) == 401

    def test_an_unparseable_timestamp_is_refused(self) -> None:
        assert self._post(timestamp="not-a-timestamp") == 401

    def test_a_retried_delivery_is_accepted_but_not_processed_twice(self) -> None:
        """Delivery is at least once, so Origin asks receivers to deduplicate."""
        assert self._post() == 204

        with mock.patch("sentry.integrations.cursor_origin.webhook.logger") as mock_logger:
            assert self._post() == 204

        assert mock_logger.info.call_args.args[0] == "cursor_origin.webhook.duplicate"

    def test_a_forged_delivery_cannot_suppress_a_real_one(self) -> None:
        """Claiming the id before verifying would let anyone silence a delivery."""
        other, _ = _signing_key()
        timestamp = str(int(time.time()))

        assert self._post(signature=_signature(other, DELIVERY_ID, timestamp, BODY)) == 401
        assert self._post() == 204

    def test_a_delivery_for_another_app_is_refused(self) -> None:
        """Origin's keys sign for every app, so the signature does not prove it was ours."""
        assert self._post(body=_envelope(app_id="app_someone_else")) == 401

    def test_no_published_key_asks_origin_to_retry(self) -> None:
        """A 4xx is terminal, so a cold key cache must not drop a real delivery."""
        assert self._post(keys=[]) == 503

    def test_an_empty_body_is_refused(self) -> None:
        response = self.client.post(path=self.url, data=b"", content_type="application/json")
        assert response.status_code == 400


@cell_silo_test
class CursorOriginWebhookCellTest(APITestCase):
    """A cell sees deliveries replayed from the mailbox, which may have waited."""

    def setUp(self) -> None:
        super().setUp()
        self.url = "/extensions/cursor_origin/webhook/"
        self.private, self.public = _signing_key()

    def _post(self, timestamp: str) -> int:
        with (
            self.options({"cursor-origin-app.id": APP_ID}),
            mock.patch(KEYS, return_value=[self.public]),
        ):
            response = self.client.post(
                path=self.url,
                data=BODY,
                content_type="application/json",
                headers={
                    "webhook-id": DELIVERY_ID,
                    "webhook-timestamp": timestamp,
                    "webhook-signature": _signature(self.private, DELIVERY_ID, timestamp, BODY),
                    "webhook-event-type": "installation.deleted",
                },
            )
        return response.status_code

    def test_a_delivery_held_in_the_mailbox_is_still_accepted(self) -> None:
        """The window is checked at the edge; a queue wait must not lose the delivery."""
        assert self._post(str(int(time.time()) - 3600)) == 204

    def test_a_forged_signature_is_still_refused(self) -> None:
        """Dropping the window must not drop the signature with it."""
        other, _ = _signing_key()
        timestamp = str(int(time.time()))
        with (
            self.options({"cursor-origin-app.id": APP_ID}),
            mock.patch(KEYS, return_value=[self.public]),
        ):
            response = self.client.post(
                path=self.url,
                data=BODY,
                content_type="application/json",
                headers={
                    "webhook-id": DELIVERY_ID,
                    "webhook-timestamp": timestamp,
                    "webhook-signature": _signature(other, DELIVERY_ID, timestamp, BODY),
                    "webhook-event-type": "installation.deleted",
                },
            )

        assert response.status_code == 401
