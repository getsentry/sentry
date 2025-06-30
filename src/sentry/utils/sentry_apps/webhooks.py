from __future__ import annotations

import logging
from collections.abc import Callable
from typing import TYPE_CHECKING, Concatenate, ParamSpec, TypeVar

from requests import RequestException, Response
from requests.exceptions import ConnectionError, Timeout
from rest_framework import status

from sentry import options
from sentry.http import safe_urlopen
from sentry.sentry_apps.metrics import (
    SentryAppEventType,
    SentryAppWebhookFailureReason,
    SentryAppWebhookHaltReason,
)
from sentry.sentry_apps.models.sentry_app import SentryApp, track_response_code
from sentry.sentry_apps.utils.errors import SentryAppSentryError
from sentry.shared_integrations.exceptions import ApiHostError, ApiTimeoutError, ClientError
from sentry.utils.sentry_apps import SentryAppWebhookRequestsBuffer

if TYPE_CHECKING:
    from sentry.sentry_apps.api.serializers.app_platform_event import AppPlatformEvent
    from sentry.sentry_apps.services.app.model import RpcSentryApp


TIMEOUT_STATUS_CODE = 0

logger = logging.getLogger("sentry.sentry_apps.webhooks")

P = ParamSpec("P")
R = TypeVar("R")


def ignore_unpublished_app_errors(
    func: Callable[Concatenate[SentryApp | RpcSentryApp, P], R],
) -> Callable[Concatenate[SentryApp | RpcSentryApp, P], R | None]:
    def wrapper(
        sentry_app: SentryApp | RpcSentryApp, *args: P.args, **kwargs: P.kwargs
    ) -> R | None:
        try:
            return func(sentry_app, *args, **kwargs)
        except Exception:
            if sentry_app.is_published:
                raise
            else:
                return None

    return wrapper


@ignore_unpublished_app_errors
def send_and_save_webhook_request(
    sentry_app: SentryApp | RpcSentryApp,
    app_platform_event: AppPlatformEvent,
    url: str | None = None,
) -> Response:
    """
    Notify a SentryApp's webhook about an incident and log response on redis.

    :param sentry_app: The SentryApp to notify via a webhook.
    :param app_platform_event: Incident data. See AppPlatformEvent.
    :param url: The URL to hit for this webhook if it is different from `sentry_app.webhook_url`.
    :return: Webhook response
    """
    from sentry.sentry_apps.metrics import SentryAppInteractionEvent, SentryAppInteractionType

    try:
        event = SentryAppEventType(f"{app_platform_event.resource}.{app_platform_event.action}")
    except ValueError as e:
        raise SentryAppSentryError(
            message=f"{SentryAppWebhookFailureReason.INVALID_EVENT}",
        ) from e

    with SentryAppInteractionEvent(
        operation_type=SentryAppInteractionType.SEND_WEBHOOK, event_type=event
    ).capture() as lifecycle:
        buffer = SentryAppWebhookRequestsBuffer(sentry_app)
        org_id = app_platform_event.install.organization_id
        slug = sentry_app.slug_for_metrics
        url = url or sentry_app.webhook_url
        lifecycle.add_extras(
            {
                "org_id": org_id,
                "sentry_app_slug": sentry_app.slug,
                "url": url or "",
                "event": event,
                "installation_uuid": app_platform_event.install.uuid,
            }
        )

        assert url is not None
        try:
            response = safe_urlopen(
                url=url,
                data=app_platform_event.body,
                headers=app_platform_event.headers,
                timeout=options.get("sentry-apps.webhook.timeout.sec"),
            )
        except (Timeout, ConnectionError) as e:
            error_type = e.__class__.__name__.lower()
            lifecycle.add_extras(
                {
                    "reason": "send_and_save_webhook_request.timeout",
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
                headers=app_platform_event.headers,
            )
            lifecycle.record_halt(e)
            # Re-raise the exception because some of these tasks might retry on the exception
            raise

        track_response_code(response.status_code, slug, event)
        buffer.add_request(
            response_code=response.status_code,
            org_id=org_id,
            event=event,
            url=url,
            error_id=response.headers.get("Sentry-Hook-Error"),
            project_id=response.headers.get("Sentry-Hook-Project"),
            response=response,
            headers=app_platform_event.headers,
        )

        if response.status_code == status.HTTP_503_SERVICE_UNAVAILABLE:
            lifecycle.record_halt(
                halt_reason=f"send_and_save_webhook_request.{SentryAppWebhookHaltReason.INTEGRATOR_ERROR}"
            )
            raise ApiHostError.from_request(response.request)

        elif response.status_code == status.HTTP_504_GATEWAY_TIMEOUT:
            lifecycle.record_halt(
                halt_reason=f"send_and_save_webhook_request.{SentryAppWebhookHaltReason.INTEGRATOR_ERROR}"
            )
            raise ApiTimeoutError.from_request(response.request)

        elif 400 <= response.status_code < 500:
            lifecycle.record_halt(
                halt_reason=f"send_and_save_webhook_request.{SentryAppWebhookHaltReason.GOT_CLIENT_ERROR}_{response.status_code}",
                sample_log_rate=0.05,
            )
            raise ClientError(response.status_code, url, response=response)

        try:
            response.raise_for_status()
        except RequestException as e:
            lifecycle.record_halt(e)
            raise
        return response
