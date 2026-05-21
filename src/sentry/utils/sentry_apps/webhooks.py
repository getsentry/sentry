from __future__ import annotations

import logging
from collections.abc import Callable, Mapping
from types import FrameType
from typing import TYPE_CHECKING, Any, Concatenate, ParamSpec, TypeVar
from urllib.parse import urlparse

import sentry_sdk
from django.conf import settings
from requests import RequestException, Response
from requests.exceptions import ChunkedEncodingError, ConnectionError, Timeout
from rest_framework import status

from sentry import features, options
from sentry.exceptions import RestrictedIPAddress
from sentry.http import safe_urlopen
from sentry.integrations.utils.metrics import EventLifecycle
from sentry.notifications.platform.service import NotificationService
from sentry.notifications.platform.target import GenericNotificationTarget
from sentry.notifications.platform.templates.sentry_app_webhook_disabled import (
    SentryAppWebhookDisabled,
)
from sentry.notifications.platform.types import (
    NotificationProviderKey,
    NotificationTargetResourceType,
)
from sentry.organizations.services.organization.model import (
    RpcOrganization,
    RpcUserOrganizationContext,
)
from sentry.organizations.services.organization.service import organization_service
from sentry.sentry_apps.metrics import (
    SentryAppEventType,
    SentryAppWebhookFailureReason,
    SentryAppWebhookHaltReason,
)
from sentry.sentry_apps.models.sentry_app import SentryApp, track_response_code
from sentry.sentry_apps.services.app.service import app_service
from sentry.sentry_apps.utils.errors import SentryAppSentryError
from sentry.shared_integrations.exceptions import ApiHostError, ApiTimeoutError, ClientError
from sentry.silo.base import SiloMode
from sentry.taskworker.timeout import timeout_alarm
from sentry.utils import metrics, redis
from sentry.utils.circuit_breaker2 import CircuitBreaker, RateBasedTripStrategy
from sentry.utils.http import absolute_uri
from sentry.utils.sentry_apps import SentryAppWebhookRequestsBuffer
from sentry.utils.sentry_apps.circuit_breaker import circuit_breaker_tracking

if TYPE_CHECKING:
    from sentry.sentry_apps.api.serializers.app_platform_event import AppPlatformEvent
    from sentry.sentry_apps.services.app.model import RpcSentryApp


TIMEOUT_STATUS_CODE = 0

logger = logging.getLogger("sentry.sentry_apps.webhooks")

P = ParamSpec("P")
R = TypeVar("R")
T = TypeVar("T", bound=Mapping[str, Any])


class WebhookTimeoutError(Exception):
    """This error represents a user set hard timeout for when a
    webhook request should've completed within X seconds
    """

    pass


def _handle_webhook_timeout(signum: int, frame: FrameType | None) -> None:
    """Handler for when a webhook request exceeds the hard timeout deadline.
    - This is a workaround for safe_create_connection sockets hanging when the given url
    cannot be reached or resolved.
    """
    raise WebhookTimeoutError("Webhook request exceeded hard timeout deadline")


def ignore_unpublished_app_errors(
    func: Callable[Concatenate[SentryApp | RpcSentryApp, P], R],
) -> Callable[Concatenate[SentryApp | RpcSentryApp, P], R | None]:
    def wrapper(
        sentry_app: SentryApp | RpcSentryApp, *args: P.args, **kwargs: P.kwargs
    ) -> R | None:
        try:
            return func(sentry_app, *args, **kwargs)
        except (Exception, RequestException):
            if sentry_app.is_published:
                raise
            else:
                return None

    return wrapper


def _create_circuit_breaker(
    sentry_app: SentryApp | RpcSentryApp,
    organization_context: RpcUserOrganizationContext | None,
) -> CircuitBreaker | None:
    if organization_context is None or not features.has(
        "organizations:sentry-app-webhook-circuit-breaker",
        organization_context.organization,
    ):
        return None

    # We don't want to make a circuit breaker in CONTROL silo as it's only used for installation webhooks which are v. low volume
    if SiloMode.get_current_mode() == SiloMode.CONTROL:
        return None

    config = options.get("sentry-apps.webhook.circuit-breaker.config")
    return CircuitBreaker(
        key=f"sentry-app.webhook.{sentry_app.slug}",
        config=config,
        trip_strategy=RateBasedTripStrategy.from_config(config),
    )


def set_dedup_key(sentry_app: SentryApp | RpcSentryApp, circuit_breaker: CircuitBreaker) -> bool:
    """Set the dedup key for circuit breaker notification. Returns True if
    this is the first notification in the window (caller should send email)."""
    dedup_ttl = max(
        circuit_breaker.broken_state_duration + circuit_breaker.recovery_duration,
        86400,  # 24 hours
    )
    client = redis.redis_clusters.get(settings.SENTRY_RATE_LIMIT_REDIS_CLUSTER)
    dedup_key = f"sentry-app.webhook.circuit-breaker.notified.{sentry_app.slug}"
    if not client.set(dedup_key, "1", ex=dedup_ttl, nx=True):
        client.expire(dedup_key, dedup_ttl)
        return False
    return True


def _get_notification_recipients(
    sentry_app: SentryApp | RpcSentryApp,
) -> list[str]:
    return app_service.get_notification_emails_for_sentry_app(
        organization_id=sentry_app.owner_id,
        creator_label=sentry_app.creator_label,
    )


def _notify_webhook_disabled(
    circuit_breaker: CircuitBreaker,
    sentry_app: SentryApp | RpcSentryApp,
    owner_org: RpcOrganization,
) -> None:
    recipient_emails = _get_notification_recipients(sentry_app)[:1]
    if not recipient_emails:
        logger.info(
            "sentry_app.webhook.circuit_breaker.no_recipients",
            extra={"slug": sentry_app.slug, "owner_id": sentry_app.owner_id},
        )
        return

    if not set_dedup_key(sentry_app, circuit_breaker):
        return

    live_run = features.has(
        "organizations:sentry-app-webhook-circuit-breaker-live-run",
        owner_org,
    )
    if not live_run:
        logger.info(
            "sentry_app.webhook.circuit_breaker.would_email",
            extra={"slug": sentry_app.slug},
        )
        return

    data = SentryAppWebhookDisabled(
        sentry_app_slug=sentry_app.slug,
        sentry_app_name=sentry_app.name,
        webhook_url=sentry_app.webhook_url or "",
        settings_url=absolute_uri(
            f"/settings/{owner_org.slug}/developer-settings/{sentry_app.slug}/"
        ),
    )

    if not NotificationService.has_access(owner_org, data.source):
        return

    NotificationService(data=data).notify_async(
        targets=[
            GenericNotificationTarget(
                provider_key=NotificationProviderKey.EMAIL,
                resource_type=NotificationTargetResourceType.EMAIL,
                resource_id=email,
            )
            for email in recipient_emails
        ]
    )


def _circuit_breaker_allows_request(
    circuit_breaker: CircuitBreaker | None,
    sentry_app: SentryApp | RpcSentryApp,
    org_id: int,
    lifecycle: EventLifecycle,
    owner_org: RpcOrganization | None,
) -> bool:
    if circuit_breaker is None or circuit_breaker.should_allow_request():
        return True

    live_run = owner_org is not None and features.has(
        "organizations:sentry-app-webhook-circuit-breaker-live-run",
        owner_org,
    )
    metrics.incr(
        "sentry_app.webhook.circuit_breaker.would_block",
        tags={"slug": sentry_app.slug, "live_run": live_run},
    )
    logger.warning(
        "sentry_app.webhook.circuit_breaker.would_block",
        extra={"slug": sentry_app.slug, "org_id": org_id, "live_run": live_run},
    )
    if not live_run:
        return True

    lifecycle.record_halt(
        halt_reason=f"send_and_save_webhook_request.{SentryAppWebhookHaltReason.CIRCUIT_BROKEN}"
    )
    return False


def _send_webhook_request(
    url: str,
    app_platform_event: AppPlatformEvent[T],
    organization_context: RpcUserOrganizationContext | None,
) -> Response:
    if organization_context is not None and features.has(
        "organizations:sentry-app-webhook-hard-timeout",
        organization_context.organization,
    ):
        # We're using a signal based timeout here because we need to interrupt the blocking
        # socket.connect() operation. See SENTRY-5HA6 for more context. Here we're hanging at
        # the socket.connect() call and the timeout we set in safe_urlopen is not being respected.
        timeout_seconds = options.get("sentry-apps.webhook.hard-timeout.sec")
        with timeout_alarm(timeout_seconds, _handle_webhook_timeout):
            return safe_urlopen(
                url=url,
                data=app_platform_event.body,
                headers=app_platform_event.headers,
                timeout=options.get("sentry-apps.webhook.timeout.sec"),
            )

    return safe_urlopen(
        url=url,
        data=app_platform_event.body,
        headers=app_platform_event.headers,
        timeout=options.get("sentry-apps.webhook.timeout.sec"),
    )


@sentry_sdk.trace(name="send_and_save_webhook_request")
@ignore_unpublished_app_errors
def send_and_save_webhook_request(
    sentry_app: SentryApp | RpcSentryApp,
    app_platform_event: AppPlatformEvent[T],
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
        if sentry_app.slug in options.get("sentry-apps.webhook.restricted-webhook-sending"):
            return Response()

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
            owner_context = organization_service.get_organization_by_id(
                id=sentry_app.owner_id,
                include_projects=False,
                include_teams=False,
            )
            owner_org = owner_context.organization if owner_context is not None else None
            circuit_breaker = _create_circuit_breaker(sentry_app, owner_context)
            if not _circuit_breaker_allows_request(
                circuit_breaker, sentry_app, org_id, lifecycle, owner_org
            ):
                return Response()

            with circuit_breaker_tracking(circuit_breaker):
                response = _send_webhook_request(url, app_platform_event, owner_context)

        except WebhookTimeoutError:
            if circuit_breaker and circuit_breaker.is_open() and owner_org is not None:
                try:
                    _notify_webhook_disabled(circuit_breaker, sentry_app, owner_org)
                except Exception as email_error:
                    lifecycle.add_extras(
                        {"reason_str": str(SentryAppWebhookHaltReason.EMAIL_FAILED)}
                    )
                    lifecycle.record_failure(failure_reason=email_error)
                    raise
            lifecycle.record_halt(
                halt_reason=f"send_and_save_webhook_request.{SentryAppWebhookHaltReason.HARD_TIMEOUT}"
            )
            raise
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
        except ChunkedEncodingError:
            lifecycle.record_halt(
                halt_reason=f"send_and_save_webhook_request.{SentryAppWebhookHaltReason.CONNECTION_RESET}"
            )
            raise
        except RestrictedIPAddress:
            lifecycle.record_halt(
                halt_reason=f"send_and_save_webhook_request.{SentryAppWebhookHaltReason.RESTRICTED_IP}"
            )
            raise

        track_response_code(response.status_code, slug, event)

        project_id = (
            int(p_id)
            if (p_id := response.headers.get("Sentry-Hook-Project")) and p_id.isdigit()
            else None
        )
        buffer.add_request(
            response_code=response.status_code,
            org_id=org_id,
            event=event,
            url=url,
            error_id=response.headers.get("Sentry-Hook-Error"),
            project_id=project_id,
            response=response,
            headers=app_platform_event.headers,
        )

        debug_logging_enabled = (
            app_platform_event.install.uuid
            in options.get("sentry-apps.webhook-logging.enabled")["installation_uuid"]
            or sentry_app.slug
            in options.get("sentry-apps.webhook-logging.enabled")["sentry_app_slug"]
        )
        if debug_logging_enabled:
            webhook_event = event
            logger.info(
                "sentry_app_webhook_sent",
                extra={
                    "sentry_app_slug": sentry_app.slug,
                    "organization_id": org_id,
                    "installation_uuid": app_platform_event.install.uuid,
                    "resource": app_platform_event.resource,
                    "action": app_platform_event.action,
                    "webhook_event": webhook_event,
                    "url": url,
                    "response_code": response.status_code,
                },
            )

        if response.status_code == status.HTTP_503_SERVICE_UNAVAILABLE:
            lifecycle.record_halt(
                halt_reason=f"send_and_save_webhook_request.{SentryAppWebhookHaltReason.INTEGRATOR_ERROR}"
            )
            raise ApiHostError(f"Unable to reach host: {urlparse(url).netloc}", url=url)

        elif response.status_code == status.HTTP_504_GATEWAY_TIMEOUT:
            lifecycle.record_halt(
                halt_reason=f"send_and_save_webhook_request.{SentryAppWebhookHaltReason.INTEGRATOR_ERROR}"
            )
            raise ApiTimeoutError(
                f"Timed out attempting to reach host: {urlparse(url).netloc}", url=url
            )

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
