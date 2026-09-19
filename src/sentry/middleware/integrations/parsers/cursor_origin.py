from __future__ import annotations

from typing import Any

from django.http import HttpResponse
from django.http.response import HttpResponseBase
from rest_framework import status

from sentry.hybridcloud.outbox.category import WebhookProviderIdentifier
from sentry.integrations.cursor_origin.constants import CURSOR_ORIGIN_WEBHOOK_SIGNATURE_PREFIX
from sentry.integrations.cursor_origin.webhook import (
    DELIVERY_ID_HEADER,
    HANDLERS,
    SIGNATURE_HEADER,
    TIMESTAMP_HEADER,
    timestamp_is_fresh,
)
from sentry.integrations.middleware.hybrid_cloud.parser import BaseRequestParser
from sentry.integrations.models.integration import Integration
from sentry.utils import metrics

EVENT_TYPE_HEADER = "webhook-event-type"
INSTALLATION_ID_HEADER = "webhook-installation-id"

CONTROL_EVENT_PREFIX = "installation."
PING_EVENT = "ping"

KNOWN_EVENTS = frozenset(
    {
        "installation.created",
        "installation.updated",
        "installation.suspended",
        "installation.unsuspended",
        "installation.deleted",
        "repository.created",
        "repository.deleted",
        "repository.pushed",
        "repository.metadata.updated",
        "repository.check_run.created",
        "repository.check_run.completed",
        "repository.check_run.rerequested",
        "pull_request.created",
        "pull_request.closed",
        "pull_request.merged",
        "pull_request.reopened",
        "pull_request.published",
        "pull_request.head_ref.pushed",
        "pull_request.base_ref.updated",
        "pull_request.metadata.updated",
        "pull_request.comment.created",
        "pull_request.review.submitted",
        "pull_request.review.dismissed",
        "pull_request.reviewer.added",
        "pull_request.reviewer.removed",
        "pull_request.reviewer.rerequested",
    }
)


class CursorOriginRequestParser(BaseRequestParser):
    provider = "cursor_origin"
    webhook_identifier = WebhookProviderIdentifier.CURSOR_ORIGIN

    def mailbox_bucket_id(self, data: dict[str, Any]) -> int | None:
        return self.hashed_bucket_key_at(data, "event", "payload", "repository", "id")

    def _looks_signed(self) -> bool:
        """Checks that the basic headers are present on the request."""
        headers = self.request.headers
        timestamp = headers.get(TIMESTAMP_HEADER)
        signature = headers.get(SIGNATURE_HEADER)
        if not headers.get(DELIVERY_ID_HEADER) or not timestamp or not signature:
            return False
        if not any(
            value.startswith(CURSOR_ORIGIN_WEBHOOK_SIGNATURE_PREFIX) for value in signature.split()
        ):
            return False
        return timestamp_is_fresh(timestamp)

    def get_integration_from_request(self) -> Integration | None:
        installation_id = self.request.headers.get(INSTALLATION_ID_HEADER)
        if not installation_id:
            return None
        return Integration.objects.filter(
            provider=self.provider, external_id=installation_id
        ).first()

    def get_response(self) -> HttpResponseBase:
        shed_response = self.get_shed_response()
        if shed_response is not None:
            return shed_response

        event_type = self.request.headers.get(EVENT_TYPE_HEADER)

        if (
            not event_type
            or event_type == PING_EVENT
            or event_type.startswith(CONTROL_EVENT_PREFIX)
        ):
            return self.get_response_from_control_silo()

        if event_type not in HANDLERS:
            metrics.incr(
                "cursor_origin.webhook.drop_unprocessed_event",
                tags={"event_type": event_type if event_type in KNOWN_EVENTS else "unknown"},
            )
            return HttpResponse(status=status.HTTP_202_ACCEPTED)

        if not self._looks_signed():
            metrics.incr("cursor_origin.webhook.reject_unsigned")
            return HttpResponse(status=status.HTTP_401_UNAUTHORIZED)

        integration = self.get_integration_from_request()
        if integration is None:
            return self.get_default_missing_integration_response()

        cells = self.get_cells_from_organizations()
        if not cells:
            return self.get_default_missing_integration_response()

        return self.get_response_from_webhookpayload(
            cells=cells,
            mailbox=self.get_mailbox(integration, self.get_request_body()),
            integration_id=integration.id,
        )
