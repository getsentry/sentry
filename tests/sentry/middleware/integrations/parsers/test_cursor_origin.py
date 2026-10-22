from __future__ import annotations

import time
from typing import Any
from unittest import mock

import responses
from django.core.handlers.wsgi import WSGIRequest
from django.http import HttpRequest, HttpResponse
from django.test import RequestFactory, override_settings
from django.urls import reverse
from rest_framework import status

from sentry.integrations.cursor_origin.handlers import InstallationUpdatedHandler
from sentry.integrations.cursor_origin.webhook import HANDLERS
from sentry.integrations.middleware.hybrid_cloud.parser import SHED_INBOUND_KILLSWITCH
from sentry.middleware.integrations.parsers.cursor_origin import CursorOriginRequestParser
from sentry.silo.base import SiloMode
from sentry.testutils.cases import TestCase
from sentry.testutils.cell import override_cells
from sentry.testutils.helpers.options import override_options
from sentry.testutils.outbox import assert_no_webhook_payloads, assert_webhook_payloads_for_mailbox
from sentry.testutils.silo import control_silo_test
from sentry.types.cell import Cell
from sentry.utils.hashlib import fnv1a_32

INSTALLATION_ID = "i_01example"

cell = Cell("us", 1, "https://us.testserver")
cell_config = (cell,)


def _headers(
    event_type: str | None,
    installation_id: str | None = INSTALLATION_ID,
    timestamp: str | None = None,
    signature: str | None = "v1ed,c2lnbmF0dXJl",
) -> dict[str, str]:
    """Origin's documented headers, which are all the parser reads."""
    headers = {"webhook-id": "whd_01example"}
    headers["webhook-timestamp"] = timestamp if timestamp is not None else str(int(time.time()))
    if signature is not None:
        headers["webhook-signature"] = signature
    if event_type is not None:
        headers["webhook-event-type"] = event_type
    if installation_id is not None:
        headers["webhook-installation-id"] = installation_id
    return headers


@control_silo_test
class CursorOriginRequestParserTest(TestCase):
    factory = RequestFactory()
    path = reverse("sentry-integration-cursor-origin-webhook")

    def setUp(self) -> None:
        super().setUp()
        # The parser only checks membership, so any handler stands in for one a cell
        # registers. `repository.pushed` arrives with the push handler.
        patcher = mock.patch.dict(HANDLERS, {"repository.pushed": InstallationUpdatedHandler})
        patcher.start()
        self.addCleanup(patcher.stop)

    def get_response(self, request: HttpRequest) -> HttpResponse:
        return HttpResponse(status=200, content="passthrough")

    def _request(self, **headers: str) -> WSGIRequest:
        # The body is never read here, so its contents do not matter to routing.
        return self.factory.post(
            self.path, data=b"{}", content_type="application/json", headers=headers
        )

    def _parser(self, **headers: str) -> CursorOriginRequestParser:
        return CursorOriginRequestParser(
            request=self._request(**headers), response_handler=self.get_response
        )

    def _integration(self) -> Any:
        return self.create_integration(
            organization=self.organization,
            provider="cursor_origin",
            external_id=INSTALLATION_ID,
        )

    @responses.activate
    def test_an_installation_event_stays_on_control(self) -> None:
        """These act on the integration and its organization links, which control owns."""
        response = self._parser(**_headers("installation.updated")).get_response()

        assert isinstance(response, HttpResponse)
        assert response.content == b"passthrough"
        assert len(responses.calls) == 0
        assert_no_webhook_payloads()

    @responses.activate
    def test_a_delivery_naming_no_event_stays_on_control(self) -> None:
        response = self._parser(**_headers(None)).get_response()

        assert isinstance(response, HttpResponse)
        assert response.content == b"passthrough"
        assert_no_webhook_payloads()

    @responses.activate
    def test_a_ping_stays_on_control(self) -> None:
        response = self._parser(**_headers("ping", installation_id=None)).get_response()

        assert isinstance(response, HttpResponse)
        assert response.content == b"passthrough"
        assert_no_webhook_payloads()

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @override_cells(cell_config)
    def test_a_repository_event_is_forwarded_to_the_cells(self) -> None:
        integration = self._integration()
        request = self._request(**_headers("repository.pushed"))
        parser = CursorOriginRequestParser(request=request, response_handler=self.get_response)

        response = parser.get_response()

        assert response.status_code == status.HTTP_202_ACCEPTED
        assert_webhook_payloads_for_mailbox(
            request=request,
            mailbox_name=f"cursor_origin:{integration.id}",
            cell_names=[cell.name],
        )

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @override_cells(cell_config)
    def test_an_event_no_handler_reads_is_dropped(self) -> None:
        self._integration()

        response = self._parser(**_headers("repository.check_run.created")).get_response()

        assert response.status_code == status.HTTP_202_ACCEPTED
        assert_no_webhook_payloads()

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @override_cells(cell_config)
    def test_an_unrecognised_event_is_dropped_without_tagging_it(self) -> None:
        self._integration()

        with mock.patch(
            "sentry.middleware.integrations.parsers.cursor_origin.metrics"
        ) as mock_metrics:
            response = self._parser(**_headers("repository.made_up")).get_response()

        assert response.status_code == status.HTTP_202_ACCEPTED
        assert mock_metrics.incr.call_args.kwargs["tags"] == {"event_type": "unknown"}
        assert_no_webhook_payloads()

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @override_cells(cell_config)
    def test_a_repository_event_for_an_unknown_installation_is_rejected(self) -> None:
        response = self._parser(**_headers("repository.pushed", "i_01nope")).get_response()

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert_no_webhook_payloads()

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @override_cells(cell_config)
    def test_a_repository_event_naming_no_installation_is_rejected(self) -> None:
        response = self._parser(
            **_headers("repository.pushed", installation_id=None)
        ).get_response()

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert_no_webhook_payloads()

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @override_cells(cell_config)
    def test_a_delivery_with_no_signature_is_refused_here(self) -> None:
        self._integration()

        response = self._parser(**_headers("repository.pushed", signature=None)).get_response()

        assert response.status_code == status.HTTP_401_UNAUTHORIZED
        assert_no_webhook_payloads()

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @override_cells(cell_config)
    def test_a_signature_without_the_origin_prefix_is_refused(self) -> None:
        self._integration()

        response = self._parser(
            **_headers("repository.pushed", signature="sha256=deadbeef")
        ).get_response()

        assert response.status_code == status.HTTP_401_UNAUTHORIZED
        assert_no_webhook_payloads()

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @override_cells(cell_config)
    def test_a_stale_delivery_is_refused(self) -> None:
        self._integration()
        stale = str(int(time.time()) - 600)

        response = self._parser(**_headers("repository.pushed", timestamp=stale)).get_response()

        assert response.status_code == status.HTTP_401_UNAUTHORIZED
        assert_no_webhook_payloads()

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @override_cells(cell_config)
    def test_a_repository_gives_the_mailbox_its_bucket_key(self) -> None:
        parser = self._parser(**_headers("repository.pushed"))
        body = {"event": {"payload": {"repository": {"id": "r_01example"}}}}

        key = parser.mailbox_bucket_id(body)

        assert key == fnv1a_32(b"r_01example")
        assert parser.mailbox_bucket_id(body) == key

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @override_cells(cell_config)
    def test_a_payload_naming_no_repository_is_left_unsplit(self) -> None:
        parser = self._parser(**_headers("repository.pushed"))

        assert parser.mailbox_bucket_id({}) is None
        assert parser.mailbox_bucket_id({"event": {"payload": {"repository": {}}}}) is None

    @responses.activate
    @override_options({SHED_INBOUND_KILLSWITCH: [{"provider": "cursor_origin"}]})
    def test_the_break_glass_killswitch_sheds_a_flood(self) -> None:
        """Routing straight to control skips the check the forwarding path makes."""
        response = self._parser(**_headers("repository.pushed")).get_response()

        assert response.status_code == status.HTTP_429_TOO_MANY_REQUESTS
        assert response["Retry-After"]
        assert_no_webhook_payloads()
