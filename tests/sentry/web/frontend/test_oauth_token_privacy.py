import copy
import logging
from collections.abc import Callable
from unittest.mock import patch
from urllib.parse import urlencode

import pytest
import sentry_sdk
from django.conf import settings
from django.contrib.auth.models import AnonymousUser
from django.http import HttpRequest, HttpResponse
from django.test import RequestFactory
from sentry_sdk import Client
from sentry_sdk.envelope import Envelope
from sentry_sdk.integrations.django import DjangoIntegration, _before_get_response
from sentry_sdk.integrations.logging import EventHandler
from sentry_sdk.transport import Transport
from sentry_sdk.utils import iter_event_frames

from sentry.silo.base import SiloMode
from sentry.testutils.silo import assume_test_silo_mode
from sentry.utils import json
from sentry.utils.sdk import before_send
from sentry.web.frontend.oauth_token import OAuthTokenView


def reject_exchange(view: OAuthTokenView, request: HttpRequest) -> HttpResponse:
    return view.error(request, "invalid_grant", reason="invalid setup_code")


def capture_storage_failure(view: OAuthTokenView, request: HttpRequest) -> HttpResponse:
    setup_code = request.POST["setup_code"]
    try:
        raise RuntimeError("Token storage failed")
    except RuntimeError:
        sentry_sdk.capture_exception()
    return HttpResponse(str(len(setup_code)), status=500)


@pytest.mark.parametrize(
    "handler,expected_status", [(reject_exchange, 400), (capture_storage_failure, 500)]
)
def test_oauth_setup_code_is_private_in_sdk_error_capture(
    handler: Callable[[OAuthTokenView, HttpRequest], HttpResponse], expected_status: int
) -> None:
    envelopes: list[Envelope] = []

    class CaptureTransport(Transport):
        def capture_envelope(self, envelope: Envelope) -> None:
            envelopes.append(envelope)

    request = RequestFactory().post(
        "/oauth/token/",
        urlencode(
            {
                "grant_type": "urn:sentry:params:oauth:grant-type:setup_code",
                "client_id": "example-client",
                "setup_code": "sntryc_private_example",
            }
        ),
        content_type="application/x-www-form-urlencoded",
    )
    request.user = AnonymousUser()
    client = Client(
        dsn="https://public@example.invalid/1",
        transport=CaptureTransport(),
        integrations=[DjangoIntegration()],
        default_integrations=False,
        auto_enabling_integrations=False,
        data_collection=copy.deepcopy(settings.SENTRY_SDK_CONFIG["data_collection"]),
        before_send=before_send,
    )
    logger = logging.getLogger("sentry.oauth")
    event_handler = EventHandler(level=logging.ERROR)

    try:
        with sentry_sdk.isolation_scope(), sentry_sdk.new_scope() as scope:
            scope.set_client(client)
            _before_get_response(request)
            logger.addHandler(event_handler)
            with (
                assume_test_silo_mode(SiloMode.CONTROL),
                patch.object(OAuthTokenView, "post", handler),
            ):
                response = OAuthTokenView.as_view()(request)
    finally:
        logger.removeHandler(event_handler)
        client.close()

    assert response.status_code == expected_status
    captured = next(event for envelope in envelopes if (event := envelope.get_event()) is not None)
    assert "data" not in captured["request"]
    assert all("vars" not in frame for frame in iter_event_frames(captured))
    assert "sntryc_private_example" not in json.dumps(captured)
