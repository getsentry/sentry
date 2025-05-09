import logging
from typing import Any

from jsonschema import Draft7Validator
from requests import RequestException
from requests.exceptions import ConnectionError, Timeout
from requests.models import Response

from sentry.http import safe_urlopen
from sentry.sentry_apps.metrics import (
    SentryAppEventType,
    SentryAppInteractionEvent,
    SentryAppInteractionType,
)
from sentry.sentry_apps.models.sentry_app import SentryApp, track_response_code
from sentry.sentry_apps.services.app.model import RpcSentryApp
from sentry.utils.sentry_apps import SentryAppWebhookRequestsBuffer
from sentry.utils.sentry_apps.webhooks import TIMEOUT_STATUS_CODE

logger = logging.getLogger(__name__)

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
    **kwargs: Any,
) -> Response:
    """
    Send a webhook request, and save the request into the Redis buffer for the
    app dashboard request log. Returns the response of the request.

    kwargs ends up being the arguments passed into safe_urlopen
    """

    with SentryAppInteractionEvent(
        operation_type=SentryAppInteractionType.EXTERNAL_REQUEST,
        event_type=SentryAppEventType(event),
    ).capture() as lifecycle:
        buffer = SentryAppWebhookRequestsBuffer(sentry_app)
        slug = sentry_app.slug_for_metrics

        try:
            resp = safe_urlopen(url=url, **kwargs)
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
                headers=kwargs.get("headers"),
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
            headers=kwargs.get("headers"),
        )
        try:
            resp.raise_for_status()
        except RequestException as e:
            lifecycle.record_halt(e)
            raise
        return resp
