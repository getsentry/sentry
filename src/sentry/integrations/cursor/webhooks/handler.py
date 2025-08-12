from __future__ import annotations

import hashlib
import hmac
import logging
from typing import Any

import orjson
import requests
from django.conf import settings
from django.http import HttpRequest, HttpResponse
from django.utils.crypto import constant_time_compare
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from rest_framework.request import Request

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import Endpoint, region_silo_endpoint
from sentry.integrations.services.integration import integration_service
from sentry.seer.autofix.utils import CodingAgentResult, CodingAgentStatus
from sentry.seer.signed_seer_api import sign_with_seer_secret
from sentry.utils import metrics

logger = logging.getLogger(__name__)


@region_silo_endpoint
class CursorWebhookEndpoint(Endpoint):
    owner = ApiOwner.INTEGRATIONS
    publish_status = {
        "POST": ApiPublishStatus.PRIVATE,
    }
    authentication_classes = ()
    permission_classes = ()

    @method_decorator(csrf_exempt)
    def dispatch(self, request: HttpRequest, *args, **kwargs) -> HttpResponse:
        if request.method != "POST":
            return HttpResponse(status=405)
        return super().dispatch(request, *args, **kwargs)

    def post(self, request: Request) -> HttpResponse:
        try:
            payload = orjson.loads(request.body)
        except orjson.JSONDecodeError:
            logger.warning("cursor_webhook.invalid_json")
            return HttpResponse(status=400)

        # Get event type
        event_type = payload.get("event", payload.get("event_type", "unknown"))

        # Validate webhook signature if present
        if not self._validate_signature(request, request.body):
            logger.warning("cursor_webhook.invalid_signature")
            return HttpResponse(status=401)

        # Process webhook
        try:
            self._process_webhook(payload)
            metrics.incr("cursor_webhook.processed", tags={"event_type": event_type})
            logger.info("cursor_webhook.success", extra={"event_type": event_type})
            return HttpResponse(status=204)
        except Exception:
            metrics.incr("cursor_webhook.error", tags={"event_type": event_type})
            logger.exception("cursor_webhook.processing_error", extra={"event_type": event_type})
            return HttpResponse(status=500)

    def _get_cursor_integration_secret(self, organization_id: int | None = None) -> str | None:
        """Get webhook secret from Cursor integration."""
        try:
            if organization_id:
                # Find Cursor integration for specific organization
                integrations = integration_service.get_integrations(
                    organization_id=organization_id, providers=["cursor"]
                )
            else:
                # If no organization specified, look for any Cursor integration
                # This is a fallback for now until we add organization routing
                integrations = integration_service.get_integrations(providers=["cursor"])

            for integration in integrations:
                if integration.provider == "cursor" and "webhook_secret" in integration.metadata:
                    return integration.metadata["webhook_secret"]
        except Exception as e:
            logger.warning("cursor_webhook.integration_lookup_error", extra={"error": str(e)})

        return None

    def _validate_signature(
        self, request: Request, raw_body: bytes, organization_id: int | None = None
    ) -> bool:
        """Validate webhook signature."""
        signature = request.META.get("HTTP_X_WEBHOOK_SIGNATURE")

        # Get webhook secret from integration
        secret = self._get_cursor_integration_secret(organization_id)

        if not signature:
            if secret:
                # If we have a secret configured but no signature provided, reject
                logger.warning("cursor_webhook.no_signature_provided")
                return False
            else:
                # If no secret configured and no signature, allow (backwards compatibility)
                logger.info("cursor_webhook.no_signature_validation")
                return True

        if not secret:
            # If signature provided but no secret configured, reject
            logger.warning("cursor_webhook.no_webhook_secret_found")
            return False

        # Remove "sha256=" prefix if present
        if signature.startswith("sha256="):
            signature = signature[7:]

        expected_signature = hmac.new(secret.encode("utf-8"), raw_body, hashlib.sha256).hexdigest()

        is_valid = constant_time_compare(expected_signature, signature)
        if not is_valid:
            logger.warning("cursor_webhook.signature_mismatch")

        return is_valid

    def _process_webhook(self, payload: dict[str, Any]) -> None:
        """Process webhook payload based on event type."""
        event_type = payload.get("event", payload.get("event_type", "unknown"))

        handlers = {
            "launch_complete": self._handle_launch_complete,
            "session_result": self._handle_session_result,
            "error": self._handle_error,
            "statusChange": self._handle_status_change,
        }

        handler = handlers.get(event_type, self._handle_unknown_event)
        handler(payload)

    def _handle_launch_complete(self, payload: dict[str, Any]) -> None:
        """Handle agent launch completion."""
        logger.info("cursor_webhook.launch_complete", extra=payload)
        # TODO: Update launch status, notify users, etc.

    def _handle_session_result(self, payload: dict[str, Any]) -> None:
        """Handle session results."""
        logger.info("cursor_webhook.session_result", extra=payload)
        # TODO: Process results, create commits, update issues, etc.

    def _handle_error(self, payload: dict[str, Any]) -> None:
        """Handle error events."""
        logger.warning("cursor_webhook.agent_error", extra=payload)
        # TODO: Handle agent errors, notify users, etc.

    def _handle_unknown_event(self, payload: dict[str, Any]) -> None:
        """Handle unknown event types."""
        logger.warning("cursor_webhook.unknown_event", extra=payload)

    def _handle_status_change(self, payload: dict[str, Any]) -> None:
        """Handle status change events."""
        agent_id = payload.get("id")
        cursor_status = payload.get("status")
        target = payload.get("target", {})
        pr_url = target.get("prUrl")
        agent_url = target.get("url")
        summary = payload.get("summary")

        if not agent_id or not cursor_status:
            logger.warning(
                "cursor_webhook.status_change_missing_data",
                extra={"agent_id": agent_id, "status": cursor_status},
            )
            return

        # Map Cursor status to CodingAgentStatus
        status_mapping = {
            "FINISHED": CodingAgentStatus.COMPLETED,
            "FAILED": CodingAgentStatus.FAILED,
            "RUNNING": CodingAgentStatus.RUNNING,
            "PENDING": CodingAgentStatus.PENDING,
        }

        sentry_status = status_mapping.get(cursor_status.upper())
        if not sentry_status:
            logger.warning(
                "cursor_webhook.unknown_status",
                extra={"cursor_status": cursor_status, "agent_id": agent_id},
            )
            sentry_status = CodingAgentStatus.FAILED

        logger.info(
            "cursor_webhook.status_change",
            extra={
                "agent_id": agent_id,
                "cursor_status": cursor_status,
                "sentry_status": sentry_status.value,
                "pr_url": pr_url,
                "summary": summary,
            },
        )

        # Create result object for FINISHED or FAILED status
        result = None
        if cursor_status.upper() in ["FINISHED", "FAILED"]:
            result = CodingAgentResult(
                description=summary or f"Agent {cursor_status.lower()}",
                pr_url=pr_url if cursor_status.upper() == "FINISHED" else None,
            )

        # Update the coding agent status via Seer API
        self._update_coding_agent_status(
            agent_id=agent_id,
            status=sentry_status,
            pr_url=pr_url,
            agent_url=agent_url,
            result=result,
        )

    def _update_coding_agent_status(
        self,
        agent_id: str,
        status: CodingAgentStatus,
        pr_url: str | None = None,
        agent_url: str | None = None,
        result: CodingAgentResult | None = None,
    ) -> bool:
        """Update coding agent status via Seer API using the existing state endpoint."""
        try:
            path = "/v1/automation/autofix/coding-agent/state/update"

            # Create updates object with the fields we want to update
            updates = {
                "status": status.value,
            }

            # Add optional fields if provided
            if pr_url:
                updates["pr_url"] = pr_url
            if agent_url:
                updates["agent_url"] = agent_url
            if result:
                updates["result"] = orjson.dumps(result.model_dump()).decode("utf-8")

            # The payload structure for the new partial update endpoint
            update_data = {
                "agent_id": agent_id,
                "updates": updates,
            }

            body = orjson.dumps(update_data)

            response = requests.post(
                f"{settings.SEER_AUTOFIX_URL}{path}",
                data=body,
                headers={
                    "content-type": "application/json;charset=utf-8",
                    **sign_with_seer_secret(body),
                },
                timeout=30,
            )

            response.raise_for_status()
            logger.info(
                "cursor_webhook.status_updated_to_seer",
                extra={
                    "agent_id": agent_id,
                    "status": status.value,
                    "pr_url": pr_url,
                    "has_result": result is not None,
                    "status_code": response.status_code,
                },
            )
            return True

        except Exception as e:
            logger.warning(
                "cursor_webhook.seer_update_error",
                extra={
                    "agent_id": agent_id,
                    "status": status.value,
                    "error": str(e),
                },
            )
            return False
