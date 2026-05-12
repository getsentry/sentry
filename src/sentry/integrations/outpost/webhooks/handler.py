from __future__ import annotations

import hashlib
import hmac
import logging
from typing import Any

import orjson
from django.http import HttpRequest, HttpResponse
from django.utils.crypto import constant_time_compare
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from rest_framework.exceptions import MethodNotAllowed, ParseError, PermissionDenied
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import Endpoint, cell_silo_endpoint
from sentry.integrations.outpost.integration import OutpostAgentIntegration
from sentry.integrations.services.integration import integration_service
from sentry.integrations.utils.webhook_viewer_context import webhook_viewer_context
from sentry.seer.autofix.utils import (
    CodingAgentResult,
    CodingAgentStatus,
    update_coding_agent_state,
)

logger = logging.getLogger(__name__)


@cell_silo_endpoint
class OutpostWebhookEndpoint(Endpoint):
    owner = ApiOwner.ML_AI
    publish_status = {
        "POST": ApiPublishStatus.PRIVATE,
    }
    authentication_classes = ()
    permission_classes = ()

    @method_decorator(csrf_exempt)
    def dispatch(self, request: HttpRequest, *args, **kwargs) -> HttpResponse:
        if request.method != "POST":
            raise MethodNotAllowed(request.method or "unknown")
        return super().dispatch(request, *args, **kwargs)

    def post(self, request: Request, organization_id: int) -> Response:
        try:
            payload = orjson.loads(request.body)
        except orjson.JSONDecodeError:
            logger.warning("outpost_webhook.invalid_json")
            raise ParseError("Invalid JSON")

        if not self._validate_signature(request, request.body, organization_id):
            logger.warning("outpost_webhook.invalid_signature")
            raise PermissionDenied("Invalid signature")

        with webhook_viewer_context(organization_id):
            self._process_webhook(payload)
        return self.respond(status=204)

    def _get_callback_secret(self, organization_id: int) -> str | None:
        integrations = integration_service.get_integrations(
            organization_id=organization_id, providers=["outpost"]
        )
        if not integrations:
            logger.warning(
                "outpost_webhook.no_integrations", extra={"organization_id": organization_id}
            )
            return None

        if len(integrations) > 1:
            logger.warning(
                "outpost_webhook.multiple_integrations",
                extra={"organization_id": organization_id},
            )
            return None

        installation = integrations[0].get_installation(organization_id)
        if not isinstance(installation, OutpostAgentIntegration):
            return None
        return installation.callback_secret

    def _validate_signature(self, request: Request, raw_body: bytes, organization_id: int) -> bool:
        signature = request.headers.get("X-Outpost-Signature-256")
        secret = self._get_callback_secret(organization_id)

        if not signature:
            raise PermissionDenied("No signature provided")
        if not secret:
            raise PermissionDenied("No webhook secret configured")

        if signature.startswith("sha256="):
            signature = signature[7:]

        expected = hmac.new(secret.encode("utf-8"), raw_body, hashlib.sha256).hexdigest()
        return constant_time_compare(expected, signature)

    def _process_webhook(self, payload: dict[str, Any]) -> None:
        event_type = payload.get("event", "unknown")
        if event_type == "statusChange":
            self._handle_status_change(payload)
        else:
            logger.warning("outpost_webhook.unknown_event", extra={"event": event_type})

    def _handle_status_change(self, payload: dict[str, Any]) -> None:
        agent_id = payload.get("id")
        raw_status = payload.get("status", "")
        source = payload.get("source", {})
        target = payload.get("target", {})
        pr_url = target.get("prUrl")
        agent_url = target.get("url")
        summary = payload.get("summary")

        if not agent_id or not raw_status:
            logger.warning(
                "outpost_webhook.missing_data", extra={"agent_id": agent_id, "status": raw_status}
            )
            return

        status_mapping = {"completed": CodingAgentStatus.COMPLETED, "failed": CodingAgentStatus.FAILED, "error": CodingAgentStatus.FAILED}
        status = status_mapping.get(raw_status.lower(), CodingAgentStatus.FAILED)

        repo_full_name = source.get("repository", "")

        result = CodingAgentResult(
            repo_full_name=repo_full_name,
            repo_provider="github",
            description=summary or f"Agent {status.value}",
            pr_url=pr_url if status == CodingAgentStatus.COMPLETED else None,
        )

        update_coding_agent_state(
            agent_id=agent_id,
            status=status,
            agent_url=agent_url,
            result=result,
        )

        logger.info(
            "outpost_webhook.status_updated",
            extra={"agent_id": agent_id, "status": status.value},
        )
