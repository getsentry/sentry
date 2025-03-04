from __future__ import annotations

import logging
from collections.abc import Callable
from typing import TYPE_CHECKING, Concatenate, ParamSpec, TypeVar

from requests import RequestException, Response
from requests.exceptions import ConnectionError, Timeout
from rest_framework import status

from sentry import audit_log, options
from sentry.http import safe_urlopen
from sentry.integrations.base import is_response_error, is_response_success
from sentry.integrations.models.utils import get_redis_key
from sentry.integrations.notify_disable import notify_disable
from sentry.integrations.request_buffer import IntegrationRequestBuffer
from sentry.models.organization import Organization
from sentry.sentry_apps.models.sentry_app import SentryApp, track_response_code
from sentry.shared_integrations.exceptions import ApiHostError, ApiTimeoutError, ClientError
from sentry.utils.audit import create_system_audit_entry
from sentry.utils.sentry_apps import SentryAppWebhookRequestsBuffer

if TYPE_CHECKING:
    from sentry.sentry_apps.api.serializers.app_platform_event import AppPlatformEvent
    from sentry.sentry_apps.services.app.model import RpcSentryApp


TIMEOUT_STATUS_CODE = 0

logger = logging.getLogger("sentry.sentry_apps.webhooks")

P = ParamSpec("P")
R = TypeVar("R")


def ignore_unpublished_app_errors(
    func: Callable[Concatenate[SentryApp | RpcSentryApp, P], R]
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


def check_broken(sentryapp: SentryApp | RpcSentryApp, org_id: str) -> None:
    from sentry.sentry_apps.services.app.service import app_service

    redis_key = get_redis_key(sentryapp, org_id)
    buffer = IntegrationRequestBuffer(redis_key)
    if buffer.is_integration_broken():
        org = Organization.objects.get(id=org_id)
        app_service.disable_sentryapp(id=sentryapp.id)
        notify_disable(org, sentryapp.name, redis_key, sentryapp.slug, sentryapp.webhook_url)
        buffer.clear()
        create_system_audit_entry(
            organization=org,
            target_object=org.id,
            event=audit_log.get_event_id("INTERNAL_INTEGRATION_DISABLED"),
            data={"name": sentryapp.name},
        )
        extra = {
            "sentryapp_webhook": sentryapp.webhook_url,
            "sentryapp_slug": sentryapp.slug,
            "sentryapp_uuid": sentryapp.uuid,
            "org_id": org_id,
            "buffer_record": buffer._get_all_from_buffer(),
        }
        logger.info(
            "sentryapp.disabled",
            extra=extra,
        )


def record_timeout(
    sentryapp: SentryApp | RpcSentryApp, org_id: str, e: ConnectionError | Timeout
) -> None:
    """
    Record Unpublished Sentry App timeout or connection error in integration buffer to check if it is broken and should be disabled
    """
    if not sentryapp.is_internal:
        return
    redis_key = get_redis_key(sentryapp, org_id)
    if not len(redis_key):
        return
    buffer = IntegrationRequestBuffer(redis_key)
    buffer.record_timeout()
    check_broken(sentryapp, org_id)


def record_response_for_disabling_integration(
    sentryapp: SentryApp | RpcSentryApp, org_id: str, response: Response
) -> None:
    if not sentryapp.is_internal:
        return
    redis_key = get_redis_key(sentryapp, org_id)
    if not len(redis_key):
        return
    buffer = IntegrationRequestBuffer(redis_key)
    if is_response_success(response):
        buffer.record_success()
        return
    if is_response_error(response):
        buffer.record_error()
        check_broken(sentryapp, org_id)


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

    event = f"{app_platform_event.resource}.{app_platform_event.action}"
    with SentryAppInteractionEvent(
        operation_type=SentryAppInteractionType.SEND_WEBHOOK, event_type=event
    ).capture() as lifecycle:
        buffer = SentryAppWebhookRequestsBuffer(sentry_app)

        org_id = app_platform_event.install.organization_id
        slug = sentry_app.slug_for_metrics
        url = url or sentry_app.webhook_url
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
                    "event": "send_and_save_webhook_request.timeout",
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
            record_timeout(sentry_app, org_id, e)
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
        # we don't disable alert rules for internal integrations
        # so we don't want to consider responses related to them
        # for the purpose of disabling integrations
        if app_platform_event.action != "event.alert":
            record_response_for_disabling_integration(sentry_app, org_id, response)

        if response.status_code == status.HTTP_503_SERVICE_UNAVAILABLE:
            lifecycle.record_halt(halt_reason="send_and_save_webhook_request.got-503")
            raise ApiHostError.from_request(response.request)

        elif response.status_code == status.HTTP_504_GATEWAY_TIMEOUT:
            lifecycle.record_halt(halt_reason="send_and_save_webhook_request.got-504")
            raise ApiTimeoutError.from_request(response.request)

        elif 400 <= response.status_code < 500:
            lifecycle.record_halt(
                halt_reason=f"send_and_save_webhook_request.got-{response.status_code}"
            )
            raise ClientError(response.status_code, url, response=response)

        try:
            response.raise_for_status()
        except RequestException as e:
            lifecycle.record_halt(e)
            raise
        return response
