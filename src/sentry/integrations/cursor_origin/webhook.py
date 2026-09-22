from __future__ import annotations

import base64
import hashlib
import logging
import time
from enum import Enum
from typing import Any

import orjson
from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey
from django.core.cache import cache
from django.http import HttpRequest, HttpResponse
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt

from sentry import options
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import Endpoint, all_silo_endpoint
from sentry.integrations.base import IntegrationDomain
from sentry.integrations.cursor_origin.constants import (
    CURSOR_ORIGIN_WEBHOOK_DEDUPE_SECONDS,
    CURSOR_ORIGIN_WEBHOOK_SIGNATURE_PREFIX,
    CURSOR_ORIGIN_WEBHOOK_TOLERANCE_SECONDS,
)
from sentry.integrations.cursor_origin.handlers import (
    InstallationRemovedHandler,
    InstallationRestoredHandler,
    InstallationUpdatedHandler,
    WebhookEventHandler,
)
from sentry.integrations.cursor_origin.keys import signing_keys_for
from sentry.integrations.cursor_origin.push import RepositoryPushedHandler
from sentry.integrations.cursor_origin.repository_events import RepositoryMetadataUpdatedHandler
from sentry.integrations.cursor_origin.webhook_types import OriginPayloadError
from sentry.integrations.services.integration import integration_service
from sentry.integrations.types import IntegrationProviderSlug
from sentry.integrations.utils.metrics import IntegrationWebhookEvent
from sentry.utils import metrics

logger = logging.getLogger("sentry.integrations.cursor_origin")

DELIVERY_ID_HEADER = "webhook-id"
TIMESTAMP_HEADER = "webhook-timestamp"
SIGNATURE_HEADER = "webhook-signature"
EVENT_TYPE_HEADER = "webhook-event-type"


class Verification(Enum):
    VERIFIED = "verified"
    REFUSED = "refused"
    NO_KEYS = "no_keys"


def _signed_digest(delivery_id: str, timestamp: str, body: bytes) -> bytes:
    """Return the hex digest as UTF-8 bytes, matching Origin's signed payload."""
    signed = b".".join([delivery_id.encode("utf-8"), timestamp.encode("utf-8"), body])
    return hashlib.sha256(signed).hexdigest().encode("utf-8")


def has_already_processed(delivery_id: str) -> bool:
    """Return whether this delivery was already processed.
    `cache.add` is set-if-not-exists, so concurrent retries cannot both be treated as new.
    """
    return not cache.add(
        f"cursor_origin:webhook:{delivery_id}", 1, CURSOR_ORIGIN_WEBHOOK_DEDUPE_SECONDS
    )


def _release_delivery(delivery_id: str) -> None:
    """Let Origin's next retry through, after this attempt failed to process it."""
    cache.delete(f"cursor_origin:webhook:{delivery_id}")


def timestamp_is_fresh(timestamp: str) -> bool:
    try:
        sent_at = int(timestamp)
    except ValueError:
        return False
    return abs(int(time.time()) - sent_at) <= CURSOR_ORIGIN_WEBHOOK_TOLERANCE_SECONDS


def verify_delivery(request: HttpRequest, body: bytes) -> Verification:
    """Verify that Origin signed this delivery.

    Fails closed if JWKS cannot be fetched. Deliveries have no `kid`, so every active
    signing key is tried.
    """
    delivery_id = request.headers.get(DELIVERY_ID_HEADER)
    timestamp = request.headers.get(TIMESTAMP_HEADER)
    header = request.headers.get(SIGNATURE_HEADER)
    if not delivery_id or not timestamp or not header:
        logger.warning("cursor_origin.webhook.unsigned")
        return Verification.REFUSED

    if not timestamp_is_fresh(timestamp):
        logger.warning("cursor_origin.webhook.stale_timestamp", extra={"delivery_id": delivery_id})
        return Verification.REFUSED

    encoded_signatures = [
        value[len(CURSOR_ORIGIN_WEBHOOK_SIGNATURE_PREFIX) :]
        for value in header.split()
        if value.startswith(CURSOR_ORIGIN_WEBHOOK_SIGNATURE_PREFIX)
    ]
    if not encoded_signatures:
        logger.warning("cursor_origin.webhook.invalid_prefix", extra={"delivery_id": delivery_id})
        return Verification.REFUSED

    keys = signing_keys_for(None)
    if not keys:
        return Verification.NO_KEYS

    digest = _signed_digest(delivery_id, timestamp, body)
    for encoded in encoded_signatures:
        try:
            signature = base64.b64decode(encoded, validate=True)
        except ValueError:
            logger.exception("cursor_origin.webhook.b64decode", extra={"delivery_id": delivery_id})
            continue

        for key in keys:
            try:
                Ed25519PublicKey.from_public_bytes(key.public_key).verify(signature, digest)
            except (InvalidSignature, ValueError):
                continue
            return Verification.VERIFIED

    logger.warning("cursor_origin.webhook.invalid_signature", extra={"delivery_id": delivery_id})
    return Verification.REFUSED


# Installation events are handled on control; repository events are forwarded to the
# cells, where commits live.
# `installation.created` is deliberately absent: the install pipeline has already done
# the work by the time it arrives.
HANDLERS: dict[str, type[WebhookEventHandler]] = {
    "installation.deleted": InstallationRemovedHandler,
    "installation.suspended": InstallationRemovedHandler,
    "installation.unsuspended": InstallationRestoredHandler,
    "installation.updated": InstallationUpdatedHandler,
    "repository.metadata.updated": RepositoryMetadataUpdatedHandler,
    "repository.pushed": RepositoryPushedHandler,
}


@all_silo_endpoint
class CursorOriginWebhookEndpoint(Endpoint):
    """Origin webhook reference: https://cursor.com/docs/api/origin

    Control silo: Origin always delivers the installation events, which change the
    Integration row, as GitHub's installation webhook does.
    """

    authentication_classes = ()
    permission_classes = ()

    owner = ApiOwner.CODING_WORKFLOWS
    publish_status = {
        "POST": ApiPublishStatus.PRIVATE,
    }

    @method_decorator(csrf_exempt)
    def dispatch(self, request: HttpRequest, *args: Any, **kwargs: Any) -> HttpResponse:
        if request.method != "POST":
            return HttpResponse(status=405)
        return super().dispatch(request, *args, **kwargs)

    def post(self, request: HttpRequest) -> HttpResponse:
        body = bytes(request.body)
        if not body:
            return HttpResponse(status=400)

        verification = verify_delivery(request, body)
        if verification is Verification.NO_KEYS:
            metrics.incr("cursor_origin.webhook.no_keys", sample_rate=1.0)
            return HttpResponse(status=503)
        if verification is not Verification.VERIFIED:
            metrics.incr("cursor_origin.webhook.rejected", sample_rate=1.0)
            return HttpResponse(status=401)

        try:
            envelope = orjson.loads(body)
        except orjson.JSONDecodeError:
            return HttpResponse(status=400)

        if envelope.get("appId") != options.get("cursor-origin-app.id"):
            logger.warning(
                "cursor_origin.webhook.another_app",
                extra={"delivery_id": request.headers.get(DELIVERY_ID_HEADER)},
            )
            return HttpResponse(status=401)

        delivery_id = envelope.get("deliveryId") or request.headers.get(DELIVERY_ID_HEADER, "")
        if has_already_processed(delivery_id):
            logger.info("cursor_origin.webhook.duplicate", extra={"delivery_id": delivery_id})
            metrics.incr("cursor_origin.webhook.duplicate", sample_rate=1.0)
            return HttpResponse(status=204)

        event = envelope.get("event") or {}
        event_type = event.get("type")
        logger.info(
            "cursor_origin.webhook.received",
            extra={
                "delivery_id": delivery_id,
                "event_type": event_type,
                "installation_id": envelope.get("installationId"),
            },
        )

        handler_cls = HANDLERS.get(event_type) if event_type else None
        if handler_cls is None:
            return HttpResponse(status=204)

        installation_id = envelope.get("installationId")

        try:
            # Resolved once here, so no handler reads the envelope, and every lookup
            # downstream is organization-scoped.
            context = (
                integration_service.organization_contexts(
                    provider=IntegrationProviderSlug.CURSOR_ORIGIN.value,
                    external_id=installation_id,
                )
                if installation_id
                else None
            )
            if context is None or context.integration is None:
                logger.info(
                    "cursor_origin.webhook.unknown_installation",
                    extra={"delivery_id": delivery_id, "installation_id": installation_id},
                )
                metrics.incr("cursor_origin.webhook.unknown_installation", sample_rate=1.0)
                return HttpResponse(status=204)

            with IntegrationWebhookEvent(
                interaction_type=handler_cls.EVENT_TYPE,
                domain=IntegrationDomain.SOURCE_CODE_MANAGEMENT,
                provider_key=IntegrationProviderSlug.CURSOR_ORIGIN.value,
            ).capture():
                handler_cls()(
                    event.get("payload") or {},
                    delivery_id,
                    context.integration,
                    context.organization_integrations,
                )
        except OriginPayloadError as e:
            _release_delivery(delivery_id)
            logger.warning(
                "cursor_origin.webhook.invalid_payload",
                extra={"delivery_id": delivery_id, "event_type": event_type, "error": str(e)},
            )
            metrics.incr("cursor_origin.webhook.invalid_payload", sample_rate=1.0)
            return HttpResponse(status=400)
        except Exception:
            _release_delivery(delivery_id)
            raise

        return HttpResponse(status=204)
