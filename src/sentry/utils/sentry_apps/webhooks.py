from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from requests import Response
from requests.exceptions import ConnectionError, Timeout
from rest_framework import status

from sentry.http import safe_urlopen
from sentry.models.integrations.sentry_app import track_response_code
from sentry.shared_integrations.exceptions import ApiHostError, ApiTimeoutError, ClientError
from sentry.utils.sentry_apps import SentryAppWebhookRequestsBuffer

if TYPE_CHECKING:
    from sentry.api.serializers import AppPlatformEvent
    from sentry.models import SentryApp


WEBHOOK_TIMEOUT = 5
TIMEOUT_STATUS_CODE = 0

logger = logging.getLogger("sentry.sentry_apps.webhooks")


def ignore_unpublished_app_errors(func):
    def wrapper(sentry_app, app_platform_event, url=None):
        try:
            return func(sentry_app, app_platform_event, url)
        except Exception:
            if sentry_app.is_published:
                raise
            else:
                return

    return wrapper

def is_considered_error(error: Exception) -> bool:
    return True

def is_timeout(e: Exception) -> bool:
    if e is Timeout:
        return True
    return False

def is_response_error(resp: Response) -> bool:
    if resp.status_code:
        if resp.status_code >= 400 and resp.status_code != 429 and resp.status_code < 500:
            return True
    return False

def is_response_success(resp: Response) -> bool:
    if resp.status_code:
        if resp.status_code < 300:
            return True
    return False

def record_error(sentryapp: SentryApp, error: Exception):
    redis_key = sentryapp._get_redis_key()
    if not len(redis_key):
        return
    if is_timeout(error):
        record_request_timeout(sentryapp, error)
        return
    if not is_considered_error(error):
        return
    buffer = IntegrationRequestBuffer(redis_key)
    buffer.record_error()
    if buffer.is_integration_broken():
        disable_app()

def record_request_error(sentryapp: SentryApp, resp: Response):
    redis_key = sentryapp._get_redis_key()
    if not len(redis_key):
        return
    buffer = IntegrationRequestBuffer(redis_key)
    buffer.record_error()
    if buffer.is_integration_broken():
        disable_app()

def record_request_success(sentryapp: SentryApp, resp: Response):
    redis_key = sentryapp._get_redis_key()
    if not len(redis_key):
        return
    buffer = IntegrationRequestBuffer(redis_key)
    buffer.record_success()

def record_request_timeout(sentryapp: SentryApp, resp: Response):
    redis_key = sentryapp._get_redis_key()
    if not len(redis_key):
        return
    buffer = IntegrationRequestBuffer(redis_key)
    buffer.record_timeout()
    if buffer.is_integration_broken():
        disable_app()

def record_response(sentryapp: SentryApp, response: Response):
    if is_response_error(response):
        record_request_error(sentryapp, response)
    elif is_response_success(response):
        record_request_success(sentryapp, response)

def disable_app(sentryapp: SentryApp):
    #sentryapp.update(status=ObjectStatus.DISABLED)

@ignore_unpublished_app_errors
def send_and_save_webhook_request(
    sentry_app: SentryApp,
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
    buffer = SentryAppWebhookRequestsBuffer(sentry_app)

    org_id = app_platform_event.install.organization_id
    event = f"{app_platform_event.resource}.{app_platform_event.action}"
    slug = sentry_app.slug_for_metrics
    url = url or sentry_app.webhook_url
    response = None
    try:
        response = safe_urlopen(
            url=url,
            data=app_platform_event.body,
            headers=app_platform_event.headers,
            timeout=WEBHOOK_TIMEOUT,
        )
    except (Timeout, ConnectionError) as e:
        error_type = e.__class__.__name__.lower()
        logger.info(
            "send_and_save_webhook_request.timeout",
            extra={
                "error_type": error_type,
                "organization_id": org_id,
                "integration_slug": sentry_app.slug,
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
        record_error(sentry_app, e)
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
    record_response(sentry_app, response)

    if response.status_code == status.HTTP_503_SERVICE_UNAVAILABLE:
        raise ApiHostError.from_request(response.request)

    elif response.status_code == status.HTTP_504_GATEWAY_TIMEOUT:
        raise ApiTimeoutError.from_request(response.request)

    elif 400 <= response.status_code < 500:
        raise ClientError(response.status_code, url, response=response)

    response.raise_for_status()
    return response
