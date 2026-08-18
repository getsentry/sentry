from __future__ import annotations

import logging
from typing import Any

import orjson
from django.http import HttpRequest, HttpResponse
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import Endpoint, control_silo_endpoint
from sentry.constants import ObjectStatus
from sentry.integrations.cursor_origin.webhook_signature import (
    is_timestamp_fresh,
    verify_signature,
)
from sentry.integrations.services.integration import integration_service
from sentry.integrations.types import IntegrationProviderSlug
from sentry.utils import metrics

logger = logging.getLogger("sentry.integrations.cursor_origin")

# Origin's delivery envelope wraps the event, so the type lives in both a header
# and the body. The header is used, since it is available before parsing.
EVENT_TYPE_HEADER = "webhook-event-type"
DELIVERY_ID_HEADER = "webhook-id"
TIMESTAMP_HEADER = "webhook-timestamp"
SIGNATURE_HEADER = "webhook-signature"
INSTALLATION_ID_HEADER = "webhook-installation-id"


@control_silo_endpoint
class CursorOriginWebhookEndpoint(Endpoint):
    """Receives Cursor Origin webhook deliveries.

    Signature verification is Ed25519 against Origin's published JWKS -- see
    webhook_signature.py. Deliveries are at-least-once, so consumers must
    deduplicate on the ``webhook-id`` header.

    Only installation lifecycle is acted on today. Everything else is
    acknowledged and logged: Origin retries and can disable an endpoint that
    keeps failing, so returning 200 for an event we do not handle yet is
    deliberate, not an oversight.
    """

    authentication_classes = ()
    permission_classes = ()

    owner = ApiOwner.INTEGRATION_PLATFORM
    publish_status = {"POST": ApiPublishStatus.PRIVATE}

    @method_decorator(csrf_exempt)
    def dispatch(self, request: HttpRequest, *args: Any, **kwargs: Any) -> HttpResponse:
        if request.method != "POST":
            return HttpResponse(status=405)
        return super().dispatch(request, *args, **kwargs)

    def post(self, request: HttpRequest) -> HttpResponse:
        delivery_id = request.headers.get(DELIVERY_ID_HEADER)
        timestamp = request.headers.get(TIMESTAMP_HEADER)
        signature = request.headers.get(SIGNATURE_HEADER)
        event_type = request.headers.get(EVENT_TYPE_HEADER)

        if not (delivery_id and timestamp and signature):
            logger.warning("cursor_origin.webhook.missing_headers")
            return HttpResponse(status=400)

        body = bytes(request.body)
        if not body:
            return HttpResponse(status=400)

        if not is_timestamp_fresh(timestamp):
            metrics.incr("cursor_origin.webhook.rejected", tags={"reason": "stale"})
            logger.warning("cursor_origin.webhook.stale", extra={"delivery_id": delivery_id})
            return HttpResponse(status=400)

        if not verify_signature(delivery_id, timestamp, body, signature):
            metrics.incr("cursor_origin.webhook.rejected", tags={"reason": "bad_signature"})
            logger.warning(
                "cursor_origin.webhook.invalid_signature", extra={"delivery_id": delivery_id}
            )
            return HttpResponse(status=401)

        try:
            payload = orjson.loads(body)
        except orjson.JSONDecodeError:
            return HttpResponse(status=400)

        metrics.incr("cursor_origin.webhook.received", tags={"event_type": event_type or "unknown"})

        if event_type == "installation.deleted":
            self._handle_installation_deleted(request, payload)
        else:
            # Acknowledged so Origin stops retrying; handlers land with commit
            # tracking and PR comments.
            logger.info(
                "cursor_origin.webhook.unhandled",
                extra={"event_type": event_type, "delivery_id": delivery_id},
            )

        return HttpResponse(status=204)

    def _handle_installation_deleted(self, request: HttpRequest, payload: Any) -> None:
        """Disable the integration when the app is uninstalled.

        Without this the integration keeps trying to mint tokens for an
        installation that no longer exists, which surfaces as recurring auth
        failures rather than as "someone uninstalled it".
        """
        installation_id = request.headers.get(INSTALLATION_ID_HEADER) or (
            payload.get("installationId") if isinstance(payload, dict) else None
        )
        if not installation_id:
            logger.warning("cursor_origin.webhook.deleted_without_installation_id")
            return

        result = integration_service.organization_contexts(
            provider=IntegrationProviderSlug.CURSOR_ORIGIN.value,
            external_id=installation_id,
        )
        if result.integration is None:
            # Possible if the integration was removed in Sentry first.
            logger.warning(
                "cursor_origin.webhook.deleted_missing_integration",
                extra={"installation_id": installation_id},
            )
            return

        integration_service.update_integration(
            integration_id=result.integration.id, status=ObjectStatus.DISABLED
        )
        logger.info(
            "cursor_origin.webhook.installation_deleted",
            extra={
                "installation_id": installation_id,
                "integration_id": result.integration.id,
            },
        )
