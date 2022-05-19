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


@ignore_unpublished_app_errors
def send_and_save_webhook_request(sentry_app, app_platform_event, url=None):
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
    try:
        resp = safe_urlopen(
            url=url, data=app_platform_event.body, headers=app_platform_event.headers, timeout=5
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
        # Response code of 0 represents timeout
        buffer.add_request(
            response_code=0,
            org_id=org_id,
            event=event,
            url=url,
            response=resp,
            headers=app_platform_event.headers,
        )
        # Re-raise the exception because some of these tasks might retry on the exception
        raise

    else:
        track_response_code(resp.status_code, slug, event)
        buffer.add_request(
            response_code=resp.status_code,
            org_id=org_id,
            event=event,
            url=url,
            error_id=resp.headers.get("Sentry-Hook-Error"),
            project_id=resp.headers.get("Sentry-Hook-Project"),
            response=resp,
            headers=app_platform_event.headers,
        )

        if resp.status_code == 503:
            raise ApiHostError.from_request(resp.request)

        elif resp.status_code == 504:
            raise ApiTimeoutError.from_request(resp.request)

        if 400 <= resp.status_code < 500:
            raise ClientError(resp.status_code, url, response=resp)

        resp.raise_for_status()
        return resp
