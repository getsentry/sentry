import logging
import re
from collections.abc import Mapping
from typing import Any
from urllib.parse import urlparse

from jsonschema import Draft7Validator
from requests import RequestException
from requests.exceptions import ConnectionError, Timeout
from requests.models import Response
from rest_framework import serializers

from sentry.http import safe_urlopen
from sentry.sentry_apps.event_types import SentryAppEventType
from sentry.sentry_apps.metrics import (
    SentryAppExternalRequestFailureReason,
    SentryAppInteractionEvent,
    SentryAppInteractionType,
)
from sentry.sentry_apps.models.sentry_app import SentryApp, track_response_code
from sentry.sentry_apps.services.app.model import RpcSentryApp
from sentry.sentry_apps.utils.errors import SentryAppIntegratorError
from sentry.sentry_apps.utils.headers import mask_header_values, parse_custom_headers
from sentry.utils.sentry_apps import SentryAppWebhookRequestsBuffer
from sentry.utils.sentry_apps.webhooks import TIMEOUT_STATUS_CODE

logger = logging.getLogger(__name__)

VALID_SENTRY_APP_URI_RE = re.compile(r"^/(?!/)[^@]*$")


def validate_sentry_app_uri(uri: str) -> None:
    if not VALID_SENTRY_APP_URI_RE.match(uri):
        raise serializers.ValidationError("Invalid URI: must be a relative path starting with '/'.")


def validate_outbound_url(url: str, expected_netloc: str, uri: str = "") -> None:
    error_type = SentryAppExternalRequestFailureReason.INVALID_URI
    if uri and not VALID_SENTRY_APP_URI_RE.match(uri):
        raise SentryAppIntegratorError(
            message="URI must not alter the webhook host",
            webhook_context={
                "error_type": error_type,
                "url": url,
                "expected_netloc": expected_netloc,
            },
            status_code=400,
        )
    parsed = urlparse(url)
    if parsed.netloc != expected_netloc:
        raise SentryAppIntegratorError(
            message="URI must not alter the webhook host",
            webhook_context={
                "error_type": error_type,
                "url": url,
                "expected_netloc": expected_netloc,
            },
            status_code=400,
        )


def integrator_error_message(response: Response | None, fallback: str) -> str:
    # Shown to the submitting user only — never add this to logs; it may echo their input.
    if response is None:
        return fallback
    try:
        return response.json().get("message") or fallback
    except Exception:
        return fallback


SELECT_OPTIONS_SCHEMA = {
    "type": "array",
    "definitions": {
        "select-option": {
            "type": "object",
            "properties": {"label": {"type": "string"}, "value": {"type": "string"}},
            "required": ["label", "value"],
        }
    },
    "properties": {"type": "array", "items": {"$ref": "#definitions/select-option"}},
}

ISSUE_LINKER_SCHEMA = {
    "type": "object",
    "properties": {
        "webUrl": {"type": "string"},
        "identifier": {"type": "string"},
        "project": {"type": "string"},
    },
    "required": ["webUrl", "identifier", "project"],
}

SCHEMA_LIST = {"select": SELECT_OPTIONS_SCHEMA, "issue_link": ISSUE_LINKER_SCHEMA}


def validate(instance, schema_type):
    schema = SCHEMA_LIST[schema_type]
    v = Draft7Validator(schema)

    if not v.is_valid(instance):
        return False

    return True


def send_and_save_sentry_app_request(
    url: str,
    sentry_app: SentryApp | RpcSentryApp,
    org_id: int,
    event: str,
    headers: Mapping[str, str],
    **kwargs: Any,
) -> Response:
    """
    Send a request to a Sentry App's endpoint, attaching the app's custom
    headers, and save the request into the Redis buffer for the app dashboard
    request log. Returns the response of the request.

    kwargs ends up being the arguments passed into safe_urlopen
    """

    with SentryAppInteractionEvent(
        operation_type=SentryAppInteractionType.EXTERNAL_REQUEST,
        event_type=SentryAppEventType(event),
    ).capture() as lifecycle:
        buffer = SentryAppWebhookRequestsBuffer(sentry_app)
        slug = sentry_app.slug_for_metrics

        custom_headers = parse_custom_headers(sentry_app.webhook_headers)
        send_headers = {**custom_headers, **headers}
        # Since some headers may carry secrets, we mask them to avoid logging them
        loggable_headers = {**mask_header_values(custom_headers), **headers}

        try:
            resp = safe_urlopen(url=url, headers=send_headers, **kwargs)
        except (Timeout, ConnectionError) as e:
            error_type = e.__class__.__name__.lower()
            lifecycle.add_extras(
                {
                    "reason": "send_and_save_sentry_app_request.timeout",
                    "error_type": error_type,
                    "organization_id": org_id,
                    "integration_slug": sentry_app.slug,
                    "url": url,
                },
            )
            track_response_code(error_type, slug, event)
            buffer.add_request(
                response_code=TIMEOUT_STATUS_CODE,
                org_id=org_id,
                event=event,
                url=url,
                headers=loggable_headers,
            )
            lifecycle.record_halt(e)
            # Re-raise the exception because some of these tasks might retry on the exception
            raise

        track_response_code(resp.status_code, slug, event)
        buffer.add_request(
            response_code=resp.status_code,
            org_id=org_id,
            event=event,
            url=url,
            error_id=resp.headers.get("Sentry-Hook-Error"),
            project_id=resp.headers.get("Sentry-Hook-Project"),
            response=resp,
            headers=loggable_headers,
        )
        try:
            resp.raise_for_status()
        except RequestException as e:
            lifecycle.record_halt(e)
            raise
        return resp
